package version

import (
	"net/http"

	"github.com/gardarr/gardarr/internal/infra/database"
	"github.com/gardarr/gardarr/internal/middlewares"
	"github.com/gardarr/gardarr/pkg/env"
	"github.com/gardarr/gardarr/pkg/version"
	"github.com/gin-gonic/gin"
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
