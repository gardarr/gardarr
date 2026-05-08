package service

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	"github.com/go-playground/validator/v10"
	"github.com/jfxdev/gardarr/internal/constants"
	"github.com/jfxdev/gardarr/internal/infra/database"
	"github.com/jfxdev/gardarr/internal/middlewares"
	"github.com/jfxdev/gardarr/internal/routes/api/v1/auth"
	"github.com/jfxdev/gardarr/internal/routes/api/v1/category"
	eventsRoutes "github.com/jfxdev/gardarr/internal/routes/api/v1/events"
	"github.com/jfxdev/gardarr/internal/routes/api/v1/health"
	"github.com/jfxdev/gardarr/internal/routes/api/v1/integrations"
	"github.com/jfxdev/gardarr/internal/routes/api/v1/profile"
	"github.com/jfxdev/gardarr/internal/routes/api/v1/settings"
	"github.com/jfxdev/gardarr/internal/routes/api/v1/setup"
	"github.com/jfxdev/gardarr/internal/routes/api/v1/signup"
	"github.com/jfxdev/gardarr/internal/routes/api/v1/task_metadata"
	"github.com/jfxdev/gardarr/internal/routes/api/v1/users"
	"github.com/jfxdev/gardarr/internal/routes/api/v1/version"
	"github.com/jfxdev/gardarr/internal/routes/api/v1/workers"
	metricsRoutes "github.com/jfxdev/gardarr/internal/routes/metrics"
	"github.com/jfxdev/gardarr/internal/schemas"
	"github.com/jfxdev/gardarr/internal/services/crypto"
	"github.com/jfxdev/gardarr/internal/services/eventpoller"
	eventsService "github.com/jfxdev/gardarr/internal/services/events"
	"github.com/jfxdev/gardarr/internal/services/integration"
	settingsService "github.com/jfxdev/gardarr/internal/services/settings"
	metadata "github.com/jfxdev/gardarr/internal/services/task_metadata"
	"github.com/jfxdev/gardarr/internal/services/workermanager"
	"github.com/spf13/cobra"

	"github.com/jfxdev/gardarr/pkg/env"
	"github.com/jfxdev/gardarr/pkg/validations"
	"github.com/pkg/errors"
)

var (
	router *gin.Engine
)

// getBaseURL returns the base URL from APP_URL env var or constructs it from APP_PORT
// Falls back to BASE_URL for backward compatibility
func getBaseURL() string {
	// Check APP_URL first
	if appURL := env.Get(constants.AppURLEnv).Value(); appURL != "" {
		return appURL
	}

	// Fall back to BASE_URL for backward compatibility
	if customURL := os.Getenv("BASE_URL"); customURL != "" {
		return customURL
	}

	// Default: construct from APP_PORT
	port := env.Get(constants.AppPortEnv).Default("3200").Value()
	return fmt.Sprintf("http://localhost:%s", port)
}

func getMediaDirectory() string {
	return env.Get(constants.TorrentImageUploadDirEnv).Default("/media/uploads/images").Value()
}

func Run(cmd *cobra.Command, args []string) error {
	// Validate filesystem permissions before starting
	// Get all directory paths from environment variables
	mediaDir := getMediaDirectory()
	dbPath := env.Get("DATABASE_FILE_PATH").Default("/data/gardarr_database.db").Value()

	// Validate data directories
	if err := validations.ValidateDataDirectories(mediaDir); err != nil {
		log.Printf("❌ Filesystem validation failed: %v", err)
		return fmt.Errorf("filesystem validation failed: %w", err)
	}

	// Validate database path (this will also validate the database directory)
	if err := validations.ValidateDatabasePath(dbPath); err != nil {
		log.Printf("❌ Database path validation failed: %v", err)
		return fmt.Errorf("database path validation failed: %w", err)
	}

	log.Println("✅ Filesystem validation passed - all directories are writable")

	cryptoSvc, err := crypto.NewCryptoService()
	if err != nil {
		return err
	}

	db, err := database.NewDatabase()
	if err != nil {
		panic(fmt.Sprintf("erro ao conectar no banco: %v", err))
	}

	if err := db.Ping(context.Background()); err != nil {
		panic(fmt.Sprintf("erro ao fazer conexão com banco: %v", err))
	}

	if err := database.RunMigrations(db); err != nil {
		panic(fmt.Sprintf("erro ao rodar migrations: %v", err))
	}

	// Initialize settings service and bootstrap default settings
	settingsSvc := settingsService.NewService(db)
	if err := settingsSvc.Initialize(context.Background()); err != nil {
		panic(fmt.Sprintf("erro ao inicializar configurações: %v", err))
	}

	// Get base URL for building image URLs
	baseURL := getBaseURL()
	mediaDirectory := getMediaDirectory()

	setRouter()

	workerSvc, err := workermanager.NewService(db, cryptoSvc, baseURL, mediaDirectory)
	if err != nil {
		return err
	}

	// Events service - tracks task state changes
	eventSvc, err := eventsService.NewService(db)
	if err != nil {
		return fmt.Errorf("failed to initialize events service: %w", err)
	}
	eventChan := eventSvc.EnableRealTimeEmission(100)

	// Event poller — polls workers for task state changes to feed events system
	eventPollerSvc := eventpoller.NewService(workerSvc, eventSvc)
	ctx, cancelPoller := context.WithCancel(context.Background())
	defer cancelPoller()
	eventPollerSvc.Start(ctx)

	// Integration service - consumes events in real-time
	integrationSvc := integration.NewService(eventChan, db)
	integrationSvc.Start(ctx)

	metaSvc, err := metadata.NewService(db, baseURL, mediaDirectory)
	if err != nil {
		return err
	}

	if err = setRoutes(db, workerSvc, metaSvc, integrationSvc); err != nil {
		return err
	}

	// Register Prometheus metrics endpoint (optional, requires METRICS_USERNAME + METRICS_PASSWORD)
	if metricsModule := metricsRoutes.NewModule(router, workerSvc); metricsModule != nil {
		metricsModule.Register()
	}

	srv := &http.Server{
		Addr:    fmt.Sprintf(":%s", env.Get(constants.AppPortEnv).Default("3200").Value()),
		Handler: router,
		// set timeout due CWE-400 - Potential Slowloris Attack
		ReadHeaderTimeout: 5 * time.Second,
	}

	// Initializing the server in a goroutine so that
	// it won't block the graceful shutdown handling below
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %s\n", err)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server with
	// a timeout of 5 seconds.
	quit := make(chan os.Signal, 1)
	// kill (no param) default send syscall.SIGTERM
	// kill -2 is syscall.SIGINT
	// kill -9 is syscall.SIGKILL but can't be catch, so don't need add it
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	// The context is used to inform the server it has 5 seconds to finish
	// the request it is currently handling
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		return errors.Wrap(err, "Server forced to shutdown: ")
	}

	log.Println("Server exiting")

	return nil
}

// securityHeadersMiddleware adds comprehensive security headers
func securityHeadersMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Content Security Policy - Restrictive but compatible with React/Vite
		csp := []string{
			"default-src 'self'",
			"script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Vite needs unsafe-inline/eval in dev
			"style-src 'self' 'unsafe-inline'",                // React/Tailwind need unsafe-inline
			"img-src 'self' data: blob: https:",
			"font-src 'self' data:",
			"connect-src 'self' ws: wss:", // Allow WebSocket for dev HMR
			"frame-ancestors 'none'",
			"base-uri 'self'",
			"form-action 'self'",
			"object-src 'none'",
			"media-src 'self'",
			"worker-src 'self' blob:",
			"manifest-src 'self'",
		}

		// Allow custom CSP override via environment variable
		if customCSP := os.Getenv("CUSTOM_CSP"); customCSP != "" {
			c.Header("Content-Security-Policy", customCSP)
		} else {
			c.Header("Content-Security-Policy", strings.Join(csp, "; "))
		}

		// Prevent clickjacking
		c.Header("X-Frame-Options", "DENY")

		// XSS Protection (legacy but still good to have)
		c.Header("X-XSS-Protection", "1; mode=block")

		// Strict Transport Security - Force HTTPS (enable in production)
		c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")

		// Referrer Policy - Control referrer information
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")

		// Prevent MIME type sniffing
		c.Header("X-Content-Type-Options", "nosniff")

		// Permissions Policy - Restrict browser features
		permissions := []string{
			"geolocation=()",
			"midi=()",
			"notifications=()",
			"push=()",
			"sync-xhr=()",
			"microphone=()",
			"camera=()",
			"magnetometer=()",
			"gyroscope=()",
			"speaker=()",
			"vibrate=()",
			"fullscreen=(self)",
			"payment=()",
		}
		c.Header("Permissions-Policy", strings.Join(permissions, ", "))

		// Cross-Origin policies - different handling for media vs other routes
		if strings.HasPrefix(c.Request.URL.Path, "/media/") {
			// For authenticated media: allow cross-origin since frontend might be on different port
			c.Header("Cross-Origin-Embedder-Policy", "unsafe-none")
			c.Header("Cross-Origin-Resource-Policy", "cross-origin")
			c.Header("Cross-Origin-Opener-Policy", "same-origin-allow-popups")
		} else {
			// Strict policies for API and other routes
			c.Header("Cross-Origin-Embedder-Policy", "require-corp")
			c.Header("Cross-Origin-Resource-Policy", "same-origin")
			c.Header("Cross-Origin-Opener-Policy", "same-origin")
		}

		c.Next()
	}
}

func setRouter() {
	// Set GIN mode based on GIN_MODE environment variable (case-insensitive)
	// Falls back to LOG_LEVEL for compatibility, defaults to release mode
	ginMode := strings.TrimSpace(env.Get("GIN_MODE").Default("").Value())

	if ginMode == "" {
		// Fall back to LOG_LEVEL for compatibility
		ginMode = strings.TrimSpace(env.Get("LOG_LEVEL").Default("release").Value())
	}

	if strings.EqualFold(ginMode, "debug") {
		gin.SetMode(gin.DebugMode)
	} else {
		gin.SetMode(gin.ReleaseMode)
	}

	router = gin.Default()

	if v, ok := binding.Validator.Engine().(*validator.Validate); ok {
		schemas.RegisterCustomValidators(v)
	}

	// Derive the base URL once and normalize it to a proper origin for CORS
	baseURL := getBaseURL()
	var allowedOrigins []string

	if u, err := url.Parse(baseURL); err == nil {
		// Build origin as scheme://host (host includes port if present)
		origin := u.Scheme + "://" + u.Host
		allowedOrigins = append(allowedOrigins, origin)

		// Allow common development origins for localhost
		host := u.Hostname()
		if host == "localhost" || host == "127.0.0.1" {
			allowedOrigins = append(allowedOrigins, "http://localhost:3200", "http://localhost:5173")
		}
	} else {
		// Fallback if parsing fails
		allowedOrigins = append(allowedOrigins, strings.TrimRight(baseURL, "/"))
	}

	corsConfig := cors.Config{
		AllowOrigins:     allowedOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}

	router.Use(cors.New(corsConfig))

	// Setup Security Headers
	router.Use(securityHeadersMiddleware())
}

// createMediaHandler returns a handler for serving authenticated media files
func createMediaHandler(absMediaPath string) gin.HandlerFunc {
	return func(c *gin.Context) {
		requestedFile := strings.TrimPrefix(c.Param("filepath"), "/")

		// Security: validate path components to prevent traversal attacks
		if validateMediaPath(requestedFile) != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid file path"})
			return
		}

		// Build and validate full file path
		fullPath := filepath.Clean(filepath.Join(absMediaPath, filepath.Clean(requestedFile)))

		if !validations.IsPathWithinBase(absMediaPath, fullPath) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid file path"})
			return
		}

		// Check file exists and is not a directory
		// Path already validated, so no need to validate again
		info, err := os.Stat(fullPath)
		if os.IsNotExist(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to access file"})
			return
		}
		if info.IsDir() {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot serve directories"})
			return
		}

		// Set no-cache headers and serve file
		c.Header("Cache-Control", "no-cache, no-store, must-revalidate, private")
		c.Header("Pragma", "no-cache")
		c.Header("Expires", "0")
		c.File(fullPath)
	}
}

// validateMediaPath validates each component of a media file path
func validateMediaPath(requestedFile string) error {
	for _, comp := range strings.Split(requestedFile, "/") {
		if comp == "" {
			continue
		}
		if err := validations.ValidatePathComponent(comp); err != nil {
			return err
		}
	}
	return nil
}

// spaFallbackHandler serves the SPA index.html for non-API routes
func spaFallbackHandler(c *gin.Context) {
	if strings.HasPrefix(c.Request.URL.Path, "/v1/") {
		c.JSON(http.StatusNotFound, gin.H{"error": "API endpoint not found"})
		return
	}

	indexPath := filepath.Join("./web", "index.html")
	if _, err := os.Stat(indexPath); err == nil {
		c.File(indexPath)
	} else {
		c.JSON(http.StatusNotFound, gin.H{"error": "Frontend not found"})
	}
}

func setRoutes(db *database.Database, a *workermanager.Service, metaSvc *metadata.Service, integrationSvc *integration.Service) error {
	// Get current working directory
	wd, _ := os.Getwd()
	webPath := filepath.Join(wd, "web")
	assetsPath := filepath.Join(webPath, "assets")

	// Serve static files from the web directory FIRST
	router.Static("/assets", assetsPath)
	router.StaticFile("/logo.ico", filepath.Join(webPath, "logo.ico"))

	// Serve uploaded media files with authentication required
	mediaPath := getMediaDirectory()
	absMediaPath, err := filepath.Abs(filepath.Clean(mediaPath))
	if err != nil {
		return fmt.Errorf("failed to resolve media directory path: %w", err)
	}
	router.GET("/media/*filepath", middlewares.SessionMiddleware(db), createMediaHandler(absMediaPath))

	// API routes
	v1 := router.Group("/v1")
	health.NewModule(v1, db).Register()
	auth.NewModule(v1, db).Register()
	workers.NewModule(v1, a).Register()
	category.NewModule(v1, db).Register()
	users.NewModule(v1, db).Register()
	profile.NewModule(v1, db).Register()
	signup.NewModule(v1, db).Register()
	setup.NewModule(v1, db).Register()
	settings.NewModule(v1, db, metaSvc).Register()
	version.NewModule(v1, db).Register()
	eventsModule, err := eventsRoutes.NewModule(v1, db)
	if err != nil {
		return fmt.Errorf("failed to initialize events module: %w", err)
	}
	eventsModule.Register()
	task_metadata.NewModule(v1, db, metaSvc).Register()
	integrations.NewModule(v1, db, integrationSvc).Register()

	// Serve the main index.html for all non-API routes (SPA fallback)
	router.NoRoute(spaFallbackHandler)

	return nil
}
