package health

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jfxdev/gardarr/internal/interfaces"
	"github.com/jfxdev/gardarr/internal/models"
	"github.com/jfxdev/gardarr/pkg/logger"
	"github.com/jfxdev/go-qbt"
)

type Module struct {
	group *gin.RouterGroup
	svc   interfaces.InstanceService
}

func NewModule(router *gin.RouterGroup, svc interfaces.InstanceService) *Module {
	return &Module{
		group: router.Group("/health"),
		svc:   svc,
	}
}

func (m Module) Register() {
	m.group.GET("/liveness", func(c *gin.Context) {
		// Use RefreshConnectionStatus to attempt a fresh connection check
		// instead of returning potentially stale cached status.
		// This ensures the liveness endpoint reflects the real state of
		// the qBittorrent connection, not a stale cached value.
		connStatus := m.svc.RefreshConnectionStatus(c.Request.Context())

		// Log errors for debugging
		if connStatus.Status != qbt.StatusConnected && connStatus.ErrorCode != "" {
			logger.Error("qBittorrent connection error",
				"status", connStatus.Status,
				"error_code", connStatus.ErrorCode,
				"message", connStatus.Message,
				"permanent", connStatus.Permanent,
			)
		}

		response := models.WorkerLivenessResponse{
			Status:    connStatus.Status,
			ErrorCode: string(connStatus.ErrorCode),
			Message:   connStatus.Message,
			Permanent: connStatus.Permanent,
		}

		c.JSON(http.StatusOK, response)
	})

	m.group.GET("/", func(c *gin.Context) {
		if err := m.svc.Ping(c.Request.Context()); err != nil {
			c.JSON(http.StatusInternalServerError, err.Error())
			return
		}

		c.JSON(http.StatusOK, nil)
	})
}
