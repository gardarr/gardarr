package agent

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	"github.com/go-playground/validator/v10"
	"github.com/jfxdev/gardarr/internal/constants"
	"github.com/jfxdev/gardarr/internal/interfaces"
	"github.com/jfxdev/gardarr/internal/routes/agent/v1/health"
	"github.com/jfxdev/gardarr/internal/routes/agent/v1/instance"
	"github.com/jfxdev/gardarr/internal/routes/agent/v1/tasks"
	"github.com/jfxdev/gardarr/internal/routes/agent/v1/version"
	"github.com/jfxdev/gardarr/internal/schemas"
	instanceService "github.com/jfxdev/gardarr/internal/services/instance/agent"
	taskService "github.com/jfxdev/gardarr/internal/services/task/agent"
	"github.com/jfxdev/gardarr/pkg/env"
	"github.com/jfxdev/gardarr/pkg/logger"
	"github.com/jfxdev/go-qbt"
	"github.com/pkg/errors"
	"github.com/spf13/cobra"
)

var (
	cmd = &cobra.Command{
		Use:          "agent",
		SilenceUsage: true,
		RunE:         Run,
	}
	router *gin.Engine
)

func Command() *cobra.Command {
	return cmd
}

func Run(cmd *cobra.Command, args []string) error {
	logger.Info("agent starting",
		"component", "agent",
	)

	if err := setRouter(); err != nil {
		logger.Error("failed to initialize router",
			"component", "agent",
			"error", err.Error(),
		)
		return err
	}
	logger.Debug("router initialized", "component", "agent")

	// Get qBittorrent configuration
	qbtBaseURL := env.Get(constants.QBittorrentBaseURLEnv).Value()
	qbtTimeout := time.Duration(env.Get(constants.QBittorrentRequestTimeoutSecondsEnv).Default(3).ValueInt()) * time.Second
	qbtMaxRetries := env.Get(constants.QBittorrentMaxRetriesEnv).Default(0).ValueInt()

	logger.Info("initializing qBittorrent client",
		"component", "agent",
		"base_url", qbtBaseURL,
		"timeout", qbtTimeout.String(),
		"max_retries", qbtMaxRetries,
	)

	client, err := qbt.New(qbt.Config{
		BaseURL:        qbtBaseURL,
		Username:       env.Get(constants.QBittorrentUsernameEnv).Value(),
		Password:       env.Get(constants.QBittorrentPasswordEnv).Value(),
		RequestTimeout: qbtTimeout,
		MaxRetries:     qbtMaxRetries,
		RetryBackoff:   time.Duration(env.Get(constants.QBittorrentRetryBackoffEnv).Default(1).ValueInt()) * time.Second,
	})
	if err != nil {
		logger.Error("failed to create qBittorrent client",
			"component", "agent",
			"error", err.Error(),
		)
		return err
	}
	logger.Info("qBittorrent client created", "component", "agent")

	taskSvc := taskService.New(client)
	logger.Debug("task service initialized", "component", "agent")

	instanceSvc := instanceService.New(client)
	logger.Debug("instance service initialized", "component", "agent")

	setRoutes(taskSvc, instanceSvc)
	logger.Debug("routes registered", "component", "agent")

	// Create server with timeout
	port := env.Get(constants.AgentPortEnv).Default("3100").Value()

	srv := &http.Server{
		Addr:    fmt.Sprintf(":%s", port),
		Handler: router,
		// set timeout due CWE-400 - Potential Slowloris Attack
		ReadHeaderTimeout: 5 * time.Second,
	}

	// Initializing the server in a goroutine so that
	// it won't block the graceful shutdown handling below
	go func() {
		logger.Info("agent server started",
			"component", "agent",
			"port", port,
			"address", srv.Addr,
		)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("agent server failed",
				"component", "agent",
				"error", err.Error(),
			)
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

	logger.Info("shutting down agent server", "component", "agent")

	// The context is used to inform the server it has 5 seconds to finish
	// the request it is currently handling
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		logger.Error("agent server forced to shutdown",
			"component", "agent",
			"error", err.Error(),
		)
		return errors.Wrap(err, "Server forced to shutdown: ")
	}

	logger.Info("agent server stopped", "component", "agent")

	return nil
}

func setRouter() error {
	// Set GIN mode based on LOG_LEVEL environment variable (case-insensitive)
	// Default to release mode for production, only use debug when explicitly set
	logLevel := strings.TrimSpace(env.Get("LOG_LEVEL").Default("info").Value())
	if strings.EqualFold(logLevel, "debug") {
		gin.SetMode(gin.DebugMode)
	} else {
		gin.SetMode(gin.ReleaseMode)
	}

	router = gin.Default()

	if v, ok := binding.Validator.Engine().(*validator.Validate); ok {
		schemas.RegisterCustomValidators(v)
	}

	if env.Get(constants.AgentSecretEnv).Value() == "" {
		return errors.New("AGENT_SECRET is not set")
	}

	// Setup Security Headers
	router.Use(func(c *gin.Context) {
		c.Header("X-Frame-Options", "DENY")
		c.Header("Content-Security-Policy", "default-src 'self'; connect-src *; font-src *; script-src-elem * 'unsafe-inline'; img-src * data:; style-src * 'unsafe-inline';")
		c.Header("X-XSS-Protection", "1; mode=block")
		c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")
		c.Header("Referrer-Policy", "strict-origin")
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("Permissions-Policy", "geolocation=(),midi=(),sync-xhr=(),microphone=(),camera=(),magnetometer=(),gyroscope=(),fullscreen=(self),payment=()")
		c.Next()
	})

	return nil
}

func setRoutes(t interfaces.TaskService, i interfaces.InstanceService) {
	// API routes

	v1 := router.Group("/v1")
	health.NewModule(v1, i).Register()
	tasks.NewModule(v1, t).Register()
	instance.NewModule(v1, i).Register()
	version.NewModule(v1).Register()
}
