package health

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jfxdev/gardarr/internal/infra/database"
)

type Module struct {
	group *gin.RouterGroup
	db    *database.Database
}

func NewModule(router *gin.RouterGroup, db *database.Database) *Module {
	return &Module{
		group: router.Group("/health"),
		db:    db,
	}
}

func (m Module) Register() {
	m.group.GET("/", func(c *gin.Context) {
		if err := m.db.Ping(c.Request.Context()); err != nil {
			c.JSON(http.StatusInternalServerError, err.Error())
			return
		}

		c.JSON(http.StatusOK, nil)
	})
}
