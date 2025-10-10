package agent

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gardarr/gardarr/internal/constants"
	"github.com/gardarr/gardarr/internal/interfaces"
	"github.com/gardarr/gardarr/internal/routes/agent/v1/health"
	"github.com/gardarr/gardarr/internal/routes/agent/v1/instance"
	"github.com/gardarr/gardarr/internal/routes/agent/v1/tasks"
	"github.com/gardarr/gardarr/internal/schemas"
	instanceService "github.com/gardarr/gardarr/internal/services/instance/agent"
	taskService "github.com/gardarr/gardarr/internal/services/task/agent"
	"github.com/gardarr/gardarr/pkg/env"
	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	"github.com/go-playground/validator/v10"
	"github.com/pkg/errors"
	"github.com/spf13/cobra"
)

var (
	cmd = &cobra.Command{
		Use:          "agent",
		SilenceUsage: true,
		RunE:         run,
	}
	router *gin.Engine
)

func Command() *cobra.Command {
	return cmd
}

func run(cmd *cobra.Command, args []string) error {
	if err := setRouter(); err != nil {
		return err
	}

	taskSvc, err := taskService.New()
	if err != nil {
		return err
	}

	instanceSvc, err := instanceService.New()
	if err != nil {
		return err
	}

	setRoutes(taskSvc, instanceSvc)

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

func setRouter() error {
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
}
