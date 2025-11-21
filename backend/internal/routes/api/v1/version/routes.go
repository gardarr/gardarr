package version

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jfxdev/gardarr/internal/infra/database"
	"github.com/jfxdev/gardarr/internal/middlewares"
	"github.com/jfxdev/gardarr/pkg/env"
	"github.com/jfxdev/gardarr/pkg/version"
)

// Module holds users routes configuration
type Module struct {
	group *gin.RouterGroup
	db    *database.Database
}

// NewModule creates a new users module
func NewModule(router *gin.RouterGroup, db *database.Database) *Module {
	return &Module{
		group: router.Group("/version"),
		db:    db,
	}
}

// Register registers all version routes
func (m *Module) Register() {
	m.group.Use(middlewares.SessionMiddleware(m.db))

	m.group.GET("/", m.getVersion)
}

// getVersion retrieves the version of the application
func (m *Module) getVersion(c *gin.Context) {
	versionStr := version.Version
	if value := env.Get("OVERRIDE_VERSION").Value(); value != "" {
		versionStr = value
	}

	c.JSON(http.StatusOK, gin.H{
		"version": versionStr,
		"commit":  version.Commit,
		"date":    version.Date,
	})
}
