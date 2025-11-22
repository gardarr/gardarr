package setup

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jfxdev/gardarr/internal/infra/database"
	"github.com/jfxdev/gardarr/internal/mappers"
	"github.com/jfxdev/gardarr/internal/models"
	"github.com/jfxdev/gardarr/internal/services/setup"
	"github.com/jfxdev/gardarr/internal/services/statistics"
	"github.com/jfxdev/gardarr/internal/services/user"
)

// Module holds setup routes configuration
type Module struct {
	group        *gin.RouterGroup
	db           *database.Database
	setupService *setup.Service
	statsService *statistics.Service
}

// NewModule creates a new setup module
func NewModule(router *gin.RouterGroup, db *database.Database, statsSvc *statistics.Service) *Module {
	return &Module{
		group:        router.Group("/setup"),
		db:           db,
		setupService: setup.NewService(user.NewService(db)),
		statsService: statsSvc,
	}
}

// Register registers all setup routes
func (m *Module) Register() {
	// Public routes - no authentication required
	m.group.GET("/", m.checkSetup)
	m.group.POST("/", m.createAdmin)
}

// checkSetup returns whether the system has been initialized
// System is initialized if at least one user exists
func (m *Module) checkSetup(c *gin.Context) {
	initialized, err := m.setupService.Initialized(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to check setup status",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"initialized":        initialized,
		"statistics_enabled": m.statsService.Enabled(),
	})
}

// PublicSignupRequest represents the request body for public signup
type PublicSignupRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
}

// createAdmin creates the first admin user during initial setup
func (m *Module) createAdmin(c *gin.Context) {
	// Check if system is already initialized
	initialized, err := m.setupService.Initialized(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to check setup status",
		})
		return
	}

	// Only allow if no users exist yet
	if initialized {
		c.JSON(http.StatusForbidden, gin.H{
			"error": "System is already initialized",
		})
		return
	}

	var req PublicSignupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request body",
		})
		return
	}

	// Create admin user
	createdUser, err := m.setupService.CreateAdmin(c.Request.Context(), req.Email, req.Password)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, models.AuthResponse{
		User: mappers.ToUserResponse(createdUser),
	})
}
