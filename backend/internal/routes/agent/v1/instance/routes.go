package instance

import (
	"net/http"

	"github.com/gardarr/gardarr/internal/interfaces"
	"github.com/gardarr/gardarr/internal/mappers"
	"github.com/gardarr/gardarr/internal/middlewares"
	"github.com/gardarr/gardarr/internal/schemas"
	"github.com/gin-gonic/gin"
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
	m.group.Use(middlewares.RequireAgentBearerToken())

	m.group.GET("/", m.getInstance)
	m.group.GET("/preferences", m.getPreferences)
	m.group.POST("/download_speed_limit", m.setDownloadSpeedLimit)
	m.group.POST("/upload_speed_limit", m.setUploadSpeedLimit)
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

func (m *Module) setDownloadSpeedLimit(c *gin.Context) {
	var body schemas.InstanceSetDownloadSpeedLimitSchema
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := m.controller.SetDownloadSpeedLimit(c.Request.Context(), body); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "download speed limit set successfully"})
}

func (m *Module) setUploadSpeedLimit(c *gin.Context) {
	var body schemas.InstanceSetUploadSpeedLimitSchema
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := m.controller.SetUploadSpeedLimit(c.Request.Context(), body); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "upload speed limit set successfully"})
}
