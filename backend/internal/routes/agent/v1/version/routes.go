package version

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jfxdev/gardarr/internal/constants"
	"github.com/jfxdev/gardarr/internal/middlewares"
	"github.com/jfxdev/gardarr/pkg/env"
	"github.com/jfxdev/gardarr/pkg/version"
)

// Module holds users routes configuration
type Module struct {
	group *gin.RouterGroup
}

// NewModule creates a new users module
func NewModule(router *gin.RouterGroup) *Module {
	return &Module{
		group: router.Group("/version"),
	}
}

// Register registers all version routes
func (m *Module) Register() {
	m.group.Use(middlewares.RequireAgentBearerToken())

	m.group.GET("/", m.getVersion)
}

// getVersion retrieves the version of the application
func (m *Module) getVersion(c *gin.Context) {
	resp := gin.H{
		"version": version.Version,
		"commit":  version.Commit,
		"date":    version.Date,
	}
	if u := env.Get(constants.QBittorrentBaseURLEnv).Value(); u != "" {
		resp["qbittorrent_url"] = u
	}
	c.JSON(http.StatusOK, resp)
}
