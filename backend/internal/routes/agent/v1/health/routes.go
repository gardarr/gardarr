package health

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jfxdev/gardarr/internal/interfaces"
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
		status := m.svc.GetStatus(c.Request.Context())
		c.JSON(http.StatusOK, gin.H{"status": status})
	})

	m.group.GET("/", func(c *gin.Context) {
		if err := m.svc.Ping(c.Request.Context()); err != nil {
			c.JSON(http.StatusInternalServerError, err.Error())
			return
		}

		c.JSON(http.StatusOK, nil)
	})
}
