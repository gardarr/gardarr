package profile

import (
	"net/http"

	"github.com/gardarr/gardarr/internal/entities"
	"github.com/gardarr/gardarr/internal/infra/database"
	"github.com/gardarr/gardarr/internal/middlewares"
	"github.com/gardarr/gardarr/internal/schemas"
	"github.com/gardarr/gardarr/internal/services/user"
	"github.com/gin-gonic/gin"
)

// Module holds profile routes configuration
type Module struct {
	group       *gin.RouterGroup
	userService *user.Service
	db          *database.Database
}

// NewModule creates a new profile module
func NewModule(router *gin.RouterGroup, db *database.Database) *Module {
	return &Module{
		group:       router.Group("/profile"),
		userService: user.NewService(db),
		db:          db,
	}
}

// Register registers all profile routes
func (m *Module) Register() {
	// Protected routes - require authentication
	protected := m.group.Group("")
	protected.Use(middlewares.SessionMiddleware(m.db))
	protected.PUT("/password", m.changePassword)
}

// changePassword allows the authenticated user to change their own password
func (m *Module) changePassword(c *gin.Context) {
	// Get the current user from context
	user, exists := c.Get(middlewares.UserContextKey)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Authentication required",
		})
		return
	}

	currentUser := user.(*entities.User)

	// Parse request body
	var req schemas.ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Validation failed",
			"details": err.Error(),
		})
		return
	}

	// Verify current password
	_, err := m.userService.VerifyPassword(c.Request.Context(), currentUser.Email, req.CurrentPassword)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Current password is incorrect",
		})
		return
	}

	// Update password
	err = m.userService.UpdatePassword(c.Request.Context(), currentUser.Email, req.NewPassword)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to update password",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Password updated successfully",
	})
}
