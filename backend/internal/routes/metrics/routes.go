package metrics

import (
	"crypto/subtle"
	"net/http"

	"github.com/gin-gonic/gin"
	metricsService "github.com/jfxdev/gardarr/internal/services/metrics"
	"github.com/jfxdev/gardarr/internal/services/workermanager"
	"github.com/jfxdev/gardarr/pkg/env"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// Module holds metrics route configuration
type Module struct {
	router      *gin.Engine
	workers     *workermanager.Service
	username    string
	password    string
	disableAuth bool
}

// NewModule creates a new metrics module. Returns nil if metrics are not enabled.
func NewModule(router *gin.Engine, workers *workermanager.Service) *Module {
	enabled := env.Get("METRICS_ENABLED").Default(false).ValueBool()
	if !enabled {
		return nil
	}

	disableAuth := env.Get("METRICS_DISABLE_AUTH").Default(false).ValueBool()
	username := env.Get("METRICS_USERNAME").Value()
	password := env.Get("METRICS_PASSWORD").Value()

	if !disableAuth && (username == "" || password == "") {
		return nil
	}

	return &Module{
		router:      router,
		workers:     workers,
		username:    username,
		password:    password,
		disableAuth: disableAuth,
	}
}

// Register registers the /metrics endpoint.
func (m *Module) Register() {
	// Create a custom registry to avoid default Go runtime metrics
	registry := prometheus.NewRegistry()
	exporter := metricsService.NewExporter(m.workers)
	registry.MustRegister(exporter)

	handler := promhttp.HandlerFor(registry, promhttp.HandlerOpts{})

	if m.disableAuth {
		m.router.GET("/metrics", gin.WrapH(handler))
	} else {
		m.router.GET("/metrics", m.basicAuth(), gin.WrapH(handler))
	}
}

func (m *Module) basicAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		user, pass, ok := c.Request.BasicAuth()
		if !ok ||
			subtle.ConstantTimeCompare([]byte(user), []byte(m.username)) != 1 ||
			subtle.ConstantTimeCompare([]byte(pass), []byte(m.password)) != 1 {
			c.Header("WWW-Authenticate", `Basic realm="metrics"`)
			c.AbortWithStatus(http.StatusUnauthorized)
			return
		}
		c.Next()
	}
}
