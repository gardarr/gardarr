package instance

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/jfxdev/gardarr/internal/interfaces"
	"github.com/jfxdev/gardarr/internal/mappers"
	"github.com/jfxdev/gardarr/internal/middlewares"
	"github.com/jfxdev/gardarr/internal/schemas"
)

type Module struct {
	controller interfaces.InstanceService
	group      *gin.RouterGroup
}

func NewModule(router *gin.RouterGroup, svc interfaces.InstanceService) *Module {
	return &Module{
		controller: svc,
		group:      router.Group("/instance"),
	}
}

func (m Module) Register() {
	m.group.Use(middlewares.RequireWorkerBearerToken())

	m.group.GET("/", m.getInstance)
	m.group.GET("/preferences", m.getPreferences)
	m.group.POST("/speed/limits", m.setSpeedLimit)
	m.group.POST("/active/limits", m.setMaxActiveTorrentLimits)
	m.group.GET("/logs", m.getLogs)
}

func (m *Module) getInstance(c *gin.Context) {
	result, err := m.controller.GetInstance(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, err.Error())
		return
	}

	c.JSON(http.StatusOK, mappers.ToInstanceResponse(result))
}

func (m *Module) getPreferences(c *gin.Context) {
	result, err := m.controller.GetPreferences(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, err.Error())
		return
	}

	c.JSON(http.StatusOK, mappers.ToInstancePreferencesResponse(result))
}

func (m *Module) setSpeedLimit(c *gin.Context) {
	var body schemas.InstanceSetSpeedLimitSchema
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := m.controller.SetSpeedLimit(c.Request.Context(), body); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "speed limits were set successfully"})
}

func (m *Module) setMaxActiveTorrentLimits(c *gin.Context) {
	var body schemas.InstanceSetMaxActiveTorrentLimitsSchema
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := m.controller.SetMaxActiveTorrentLimits(c.Request.Context(), body); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "max active torrent limits were set successfully"})
}

func (m *Module) getLogs(c *gin.Context) {
	normal := c.Query("normal") == "true"
	info := c.Query("info") == "true"
	warning := c.Query("warning") == "true"
	critical := c.Query("critical") == "true"

	lastKnownID := 0
	if idStr := c.Query("last_known_id"); idStr != "" {
		if id, err := strconv.Atoi(idStr); err == nil {
			lastKnownID = id
		}
	}

	logs, err := m.controller.GetLogs(c.Request.Context(), normal, info, warning, critical, lastKnownID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, logs)
}
