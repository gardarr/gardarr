package service

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/gardarr/gardarr/cmd/agent"
	"github.com/gardarr/gardarr/internal/constants"
	"github.com/gardarr/gardarr/internal/infra/database"
	"github.com/gardarr/gardarr/internal/middlewares"
	"github.com/gardarr/gardarr/internal/routes/api/v1/agents"
	"github.com/gardarr/gardarr/internal/routes/api/v1/auth"
	"github.com/gardarr/gardarr/internal/routes/api/v1/category"
	"github.com/gardarr/gardarr/internal/routes/api/v1/events"
	"github.com/gardarr/gardarr/internal/routes/api/v1/health"
	"github.com/gardarr/gardarr/internal/routes/api/v1/profile"
	"github.com/gardarr/gardarr/internal/routes/api/v1/settings"
	"github.com/gardarr/gardarr/internal/routes/api/v1/setup"
	"github.com/gardarr/gardarr/internal/routes/api/v1/signup"
	statsroutes "github.com/gardarr/gardarr/internal/routes/api/v1/statistics"
	"github.com/gardarr/gardarr/internal/routes/api/v1/task_metadata"
	"github.com/gardarr/gardarr/internal/routes/api/v1/users"
	"github.com/gardarr/gardarr/internal/routes/api/v1/version"
	"github.com/gardarr/gardarr/internal/schemas"
	"github.com/gardarr/gardarr/internal/services/agentmanager"
	"github.com/gardarr/gardarr/internal/services/crypto"
	settingsService "github.com/gardarr/gardarr/internal/services/settings"
	"github.com/gardarr/gardarr/internal/services/statistics"
	metadata "github.com/gardarr/gardarr/internal/services/task_metadata"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	"github.com/go-playground/validator/v10"
	"github.com/spf13/cobra"

	"github.com/gardarr/gardarr/pkg/env"
	"github.com/gardarr/gardarr/pkg/gen"
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
	port := env.Get(constants.AppPortEnv).Default("3000").Value()
	return fmt.Sprintf("http://localhost:%s", port)
}

func getMediaDirectory() string {
	return env.Get(constants.TorrentImageUploadDirEnv).Default("/media/uploads/images").Value()
}

func Run(cmd *cobra.Command, args []string) error {
	// Check if APP_MODE is set to standalone
	appMode := env.Get(constants.AppModeEnv).Value()
	isStandalone := appMode == constants.StandaloneMode

	if isStandalone {
		if env.Get(constants.AgentSecretEnv).Value() == "" {
			secret, err := gen.GeneratePassword(32)
			if err != nil {
				return err
			}
			os.Setenv(constants.AgentSecretEnv, secret)
		}
		log.Println("🚀 Starting in STANDALONE mode - Service and Agent will run together")
	}

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

	agentSvc, err := agentmanager.NewService(db, cryptoSvc, baseURL, mediaDirectory)
	if err != nil {
		return err
	}

	// Statistics (feature-flagged)
	statsSvc := statistics.NewService(db, agentSvc)
	ctx, cancelStats := context.WithCancel(context.Background())
	defer cancelStats()
	statsSvc.Start(ctx)

	metaSvc, err := metadata.NewService(db, baseURL, mediaDirectory)
	if err != nil {
		return err
	}

	setRoutes(db, agentSvc, statsSvc, metaSvc)

	// Initialize agent service if in standalone mode
	if isStandalone {
		log.Println("🤖 Initializing agent service...")
		// Start agent service in a goroutine
		go func() {
			if err := agent.Run(cmd, args); err != nil {
				log.Printf("Error running agent service: %v", err)
			}
		}()

		// Give the agent service a moment to start up
		time.Sleep(2 * time.Second)
		log.Println("✅ Agent service started successfully on port 3100")
	}

	srv := &http.Server{
		Addr:    fmt.Sprintf(":%s", env.Get(constants.AppPortEnv).Default("3000").Value()),
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
	router = gin.Default()

	if v, ok := binding.Validator.Engine().(*validator.Validate); ok {
		schemas.RegisterCustomValidators(v)
	}

	// Get APP_URL from environment variable (default: http://localhost:3000)
	appURL := env.Get(constants.AppURLEnv).Default("http://localhost:3000").Value()

	// CORS configuration
	allowedOrigins := []string{appURL}

	// Also allow common development URLs if not explicitly set
	if appURL == "http://localhost:3000" {
		allowedOrigins = append(allowedOrigins, "http://localhost:5173")
	}

	corsConfig := cors.Config{
		AllowOrigins:     allowedOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}

	// Override with environment variables if set (APP_DOMAINS takes precedence)
	if domains := os.Getenv(constants.AppDomainsEnv); domains != "" {
		corsConfig.AllowOrigins = strings.Split(domains, ",")
	}

	router.Use(cors.New(corsConfig))

	// Setup Security Headers
	router.Use(securityHeadersMiddleware())
}

func setRoutes(db *database.Database, a *agentmanager.Service, statsSvc *statistics.Service, metaSvc *metadata.Service) {
	// Get current working directory
	wd, _ := os.Getwd()
	webPath := filepath.Join(wd, "web")
	assetsPath := filepath.Join(webPath, "assets")

	// Serve static files from the web directory FIRST
	router.Static("/assets", assetsPath)
	router.StaticFile("/logo.ico", filepath.Join(webPath, "logo.ico"))

	// Serve uploaded media files with authentication required
	mediaPath := getMediaDirectory()
	router.GET("/media/*filepath", middlewares.SessionMiddleware(db), func(c *gin.Context) {
		// Get the requested file path
		requestedFile := strings.TrimPrefix(c.Param("filepath"), "/")

		// Security: prevent path traversal attacks
		requestedFile = filepath.Clean(requestedFile)
		if requestedFile == "." || strings.HasPrefix(requestedFile, "..") || strings.Contains(requestedFile, "/../") || strings.Contains(requestedFile, `\..\\`) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid file path"})
			return
		}

		// Build full file path
		fullPath := filepath.Join(mediaPath, requestedFile)
		fullPath = filepath.Clean(fullPath)

		if !strings.HasPrefix(fullPath, mediaPath+string(os.PathSeparator)) && fullPath != mediaPath {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid file path"})
			return
		}

		// Check if file exists
		if _, err := os.Stat(fullPath); os.IsNotExist(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
			return
		}

		// Set headers to prevent caching - force browser to always check authentication
		c.Header("Cache-Control", "no-cache, no-store, must-revalidate, private")
		c.Header("Pragma", "no-cache")
		c.Header("Expires", "0")

		// Serve the file
		c.File(fullPath)
	})

	// API routes

	v1 := router.Group("/v1")
	health.NewModule(v1, db).Register()
	auth.NewModule(v1, db).Register()
	agents.NewModule(v1, a).Register()
	category.NewModule(v1, db).Register()
	users.NewModule(v1, db).Register()
	profile.NewModule(v1, db).Register()
	signup.NewModule(v1, db).Register()
	setup.NewModule(v1, db).Register()
	settings.NewModule(v1, db).Register()
	version.NewModule(v1, db).Register()
	events.NewModule(v1, db).Register()
	statsroutes.NewModule(v1, db, statsSvc).Register()
	task_metadata.NewModule(v1, db, metaSvc).Register()

	// Serve the main index.html for all non-API routes (SPA fallback)
	router.NoRoute(func(c *gin.Context) {
		// Check if the request is for an API route
		if strings.HasPrefix(c.Request.URL.Path, "/v1/") {
			c.JSON(http.StatusNotFound, gin.H{"error": "API endpoint not found"})
			return
		}

		// For all other routes, serve the index.html (SPA fallback)
		indexPath := filepath.Join("./web", "index.html")
		if _, err := os.Stat(indexPath); err == nil {
			c.File(indexPath)
		} else {
			c.JSON(http.StatusNotFound, gin.H{"error": "Frontend not found"})
		}
	})
}
