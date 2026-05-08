package worker

import (
	"context"
	"errors"
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
	"github.com/jfxdev/gardarr/internal/routes/worker/v1/health"
	"github.com/jfxdev/gardarr/internal/routes/worker/v1/instance"
	"github.com/jfxdev/gardarr/internal/routes/worker/v1/tasks"
	"github.com/jfxdev/gardarr/internal/routes/worker/v1/version"
	"github.com/jfxdev/gardarr/internal/schemas"
	instanceService "github.com/jfxdev/gardarr/internal/services/instance/worker"
	taskService "github.com/jfxdev/gardarr/internal/services/task/worker"
	"github.com/jfxdev/gardarr/pkg/env"
	"github.com/jfxdev/gardarr/pkg/logger"
	"github.com/jfxdev/go-qbt"
	pkgerrors "github.com/pkg/errors"
	"github.com/spf13/cobra"
)

var (
	cmd = &cobra.Command{
		Use:          "worker",
		SilenceUsage: true,
		RunE:         Run,
	}
	router *gin.Engine
)

func Command() *cobra.Command {
	return cmd
}

func Run(cmd *cobra.Command, args []string) error {
	logger.Info("worker starting", "component", "worker")

	if err := setRouter(); err != nil {
		logger.Error("failed to initialize router", "component", "worker", "error", err.Error())
		return err
	}
	logger.Debug("router initialized", "component", "worker")

	// Get qBittorrent configuration
	qbtBaseURL := env.Get(constants.QBittorrentBaseURLEnv).Value()
	if qbtBaseURL == "" {
		if old := env.Get(constants.QBittorrentBaseURLOldEnv).Value(); old != "" {
			logger.Warn("QBITTORRENT_BASEURL is deprecated, please rename it to QBITTORRENT_URL",
				"component", "worker",
			)
			qbtBaseURL = old
		}
	}
	qbtTimeout := time.Duration(env.Get(constants.QBittorrentRequestTimeoutSecondsEnv).Default(3).ValueInt()) * time.Second
	qbtMaxRetries := env.Get(constants.QBittorrentMaxRetriesEnv).Default(0).ValueInt()
	qbtLoginMaxRetries := env.Get(constants.QBittorrentLoginMaxRetriesEnv).Default(5).ValueInt()

	logger.Info("initializing qBittorrent client",
		"component", "worker",
		"base_url", qbtBaseURL,
		"timeout", qbtTimeout.String(),
		"max_retries", qbtMaxRetries,
		"login_max_retries", qbtLoginMaxRetries,
	)

	client, err := qbt.New(qbt.Config{
		BaseURL:         qbtBaseURL,
		Username:        env.Get(constants.QBittorrentUsernameEnv).Value(),
		Password:        env.Get(constants.QBittorrentPasswordEnv).Value(),
		RequestTimeout:  qbtTimeout,
		MaxRetries:      qbtMaxRetries,
		RetryBackoff:    time.Duration(env.Get(constants.QBittorrentRetryBackoffEnv).Default(1).ValueInt()) * time.Second,
		MaxLoginRetries: qbtLoginMaxRetries,
	})
	if err != nil {
		logger.Error("failed to create qBittorrent client",
			"component", "worker",
			"error", err.Error(),
		)
		return err
	}
	logger.Info("qBittorrent client created", "component", "worker")

	// Attempt initial login to verify connectivity and credentials
	loginCtx, loginCancel := context.WithTimeout(context.Background(), qbtTimeout)
	if err := client.Login(loginCtx); err != nil {
		logger.Warn("initial qBittorrent login failed, will retry in background",
			"component", "worker",
			"error", err.Error(),
		)
	} else {
		logger.Info("qBittorrent login successful", "component", "worker")
	}
	loginCancel()

	taskSvc := taskService.New(client)
	logger.Debug("task service initialized", "component", "worker")

	instanceSvc := instanceService.New(client)
	logger.Debug("instance service initialized", "component", "worker")

	setRoutes(taskSvc, instanceSvc)
	logger.Debug("routes registered", "component", "worker")

	// Create server with timeout
	port := env.Get(constants.WorkerPortEnv).Default("3100").Value()

	srv := &http.Server{
		Addr:    fmt.Sprintf(":%s", port),
		Handler: router,
		// set timeout due CWE-400 - Potential Slowloris Attack
		ReadHeaderTimeout: 5 * time.Second,
	}

	// Initializing the server in a goroutine so that
	// it won't block the graceful shutdown handling below
	go func() {
		logger.Info("worker server starting",
			"component", "worker",
			"port", port,
			"address", srv.Addr,
		)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("worker server failed",
				"component", "worker",
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

	// Monitor qBittorrent auth status — if permanent failure is detected
	// after MaxLoginRetries consecutive attempts, trigger graceful shutdown
	// so Docker restart policy can recover the container.
	monitorCtx, monitorCancel := context.WithCancel(context.Background())
	defer monitorCancel()
	go func() {
		ticker := time.NewTicker(10 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				if client.IsAuthFailed() {
					logger.Error("qBittorrent authentication permanently failed, shutting down worker",
						"component", "worker",
						"max_login_retries", qbtLoginMaxRetries,
					)
					quit <- syscall.SIGTERM
					return
				}
			case <-monitorCtx.Done():
				return
			}
		}
	}()

	<-quit

	logger.Info("shutting down worker server", "component", "worker")

	// The context is used to inform the server it has 5 seconds to finish
	// the request it is currently handling
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		logger.Error("worker server forced to shutdown",
			"component", "worker",
			"error", err.Error(),
		)
		return pkgerrors.Wrap(err, "server forced to shutdown")
	}

	logger.Info("worker server stopped", "component", "worker")

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

	if env.Get(constants.WorkerSecretEnv).Value() == "" {
		return pkgerrors.New("worker secret is not set")
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
