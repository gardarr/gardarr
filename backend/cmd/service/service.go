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

	"github.com/gardarr/gardarr/internal/constants"
	"github.com/gardarr/gardarr/internal/infra/database"
	"github.com/gardarr/gardarr/internal/routes/api/v1/agents"
	"github.com/gardarr/gardarr/internal/routes/api/v1/auth"
	"github.com/gardarr/gardarr/internal/routes/api/v1/category"
	"github.com/gardarr/gardarr/internal/routes/api/v1/health"
	"github.com/gardarr/gardarr/internal/schemas"
	"github.com/gardarr/gardarr/internal/services/agentmanager"
	"github.com/gardarr/gardarr/internal/services/crypto"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	"github.com/go-playground/validator/v10"
	"github.com/spf13/cobra"

	"github.com/gardarr/gardarr/pkg/env"
	"github.com/pkg/errors"
)

var router *gin.Engine

func Run(cmd *cobra.Command, args []string) error {
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

	setRouter()

	agentSvc := agentmanager.NewService(db, cryptoSvc)

	setRoutes(db, agentSvc)

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

		// Cross-Origin policies
		c.Header("Cross-Origin-Embedder-Policy", "require-corp")
		c.Header("Cross-Origin-Opener-Policy", "same-origin")
		c.Header("Cross-Origin-Resource-Policy", "same-origin")

		c.Next()
	}
}

func setRouter() {
	router = gin.Default()

	if v, ok := binding.Validator.Engine().(*validator.Validate); ok {
		schemas.RegisterCustomValidators(v)
	}

	// CORS configuration for development
	corsConfig := cors.Config{
		AllowOrigins:     []string{"http://localhost:5173", "http://localhost:3000"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}

	// Override with environment variables if set
	if domains := os.Getenv(constants.AppDomainsEnv); domains != "" {
		corsConfig.AllowOrigins = strings.Split(domains, ",")
	}

	router.Use(cors.New(corsConfig))

	// Setup Security Headers
	router.Use(securityHeadersMiddleware())
}

func setRoutes(db *database.Database, a *agentmanager.Service) {
	// Get current working directory
	wd, _ := os.Getwd()
	webPath := filepath.Join(wd, "web")
	assetsPath := filepath.Join(webPath, "assets")

	// Serve static files from the web directory FIRST
	router.Static("/assets", assetsPath)
	router.StaticFile("/favicon.ico", filepath.Join(webPath, "favicon.ico"))
	router.StaticFile("/vite.svg", filepath.Join(webPath, "vite.svg"))

	// API routes
	v1 := router.Group("/v1")
	health.NewModule(v1, db).Register()
	auth.NewModule(v1, db).Register()
	agents.NewModule(v1, a).Register()
	category.NewModule(v1, db).Register()

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
