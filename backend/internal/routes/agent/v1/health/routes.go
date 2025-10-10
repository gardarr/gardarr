package health

import (
	"net/http"

	"github.com/gardarr/gardarr/internal/interfaces"
	"github.com/gin-gonic/gin"
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
	m.group.GET("/", func(c *gin.Context) {
		if err := m.svc.Ping(c.Request.Context()); err != nil {
			c.JSON(http.StatusInternalServerError, err.Error())
			return
		}

		c.JSON(http.StatusOK, nil)
	})
}
