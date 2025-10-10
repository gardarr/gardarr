package instance

import (
	"net/http"

	"github.com/gardarr/gardarr/internal/interfaces"
	"github.com/gardarr/gardarr/internal/mappers"
	"github.com/gardarr/gardarr/internal/middlewares"
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
}

func (m *Module) getInstance(c *gin.Context) {
	result, err := m.controller.GetInstance(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, err.Error())
		return
	}

	c.JSON(http.StatusOK, mappers.ToInstanceResponse(result))
}
