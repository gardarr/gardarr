package profile

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jfxdev/gardarr/internal/entities"
	"github.com/jfxdev/gardarr/internal/infra/database"
	"github.com/jfxdev/gardarr/internal/mappers"
	"github.com/jfxdev/gardarr/internal/middlewares"
	"github.com/jfxdev/gardarr/internal/models"
	"github.com/jfxdev/gardarr/internal/schemas"
	"github.com/jfxdev/gardarr/internal/services/user"
	"gorm.io/gorm"
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
	protected.GET("/preferences", m.getPreferences)
	protected.PUT("/preferences", m.updatePreferences)
	// Legacy endpoint for backward compatibility
	protected.GET("/torrent-display-mode", m.getTorrentDisplayMode)
}

// Helper functions

// getUserFromContext extracts the authenticated user from gin context
func getUserFromContext(c *gin.Context) (*entities.User, error) {
	user, exists := c.Get(middlewares.UserContextKey)
	if !exists {
		return nil, errors.New("authentication required")
	}
	return user.(*entities.User), nil
}

// changePassword allows the authenticated user to change their own password
func (m *Module) changePassword(c *gin.Context) {
	// Get the current user from context
	currentUser, err := getUserFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": err.Error(),
		})
		return
	}

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
	_, err = m.userService.VerifyPassword(c.Request.Context(), currentUser.Email, req.CurrentPassword)
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

// getPreferences returns the user's preferences
func (m *Module) getPreferences(c *gin.Context) {
	// Get the current user from context
	currentUser, err := getUserFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": err.Error(),
		})
		return
	}

	// Get or create user preferences
	var preferences models.UserPreferences
	err = m.db.DB.Where("user_uuid = ?", currentUser.UUID).First(&preferences).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			// Return default if preferences don't exist yet
			c.JSON(http.StatusOK, mappers.GetDefaultPreferencesResponse())
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to fetch preferences",
		})
		return
	}

	c.JSON(http.StatusOK, mappers.ToPreferencesResponse(preferences))
}

// getTorrentDisplayMode returns the user's torrent display mode preference (legacy endpoint)
func (m *Module) getTorrentDisplayMode(c *gin.Context) {
	// Get the current user from context
	currentUser, err := getUserFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": err.Error(),
		})
		return
	}

	// Get or create user preferences
	var preferences models.UserPreferences
	err = m.db.DB.Where("user_uuid = ?", currentUser.UUID).First(&preferences).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			// Return default if preferences don't exist yet
			c.JSON(http.StatusOK, models.TorrentDisplayModeResponse{
				DisplayMode: "card",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to fetch preferences",
		})
		return
	}

	c.JSON(http.StatusOK, models.TorrentDisplayModeResponse{
		DisplayMode: preferences.TorrentDisplayMode,
	})
}

// updatePreferences updates the user's preferences
func (m *Module) updatePreferences(c *gin.Context) {
	// Get the current user from context
	currentUser, err := getUserFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": err.Error(),
		})
		return
	}

	// Parse request body
	var req schemas.UpdatePreferencesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Validation failed",
			"details": err.Error(),
		})
		return
	}

	// Get or create user preferences
	var preferences models.UserPreferences
	err = m.db.DB.Where("user_uuid = ?", currentUser.UUID).First(&preferences).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			// Create new preferences with defaults
			preferences = mappers.GetDefaultPreferences(currentUser.UUID)
			// Apply updates from request
			mappers.ApplyPreferenceUpdates(&preferences, req)
			if err := m.db.DB.Create(&preferences).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{
					"error": "Failed to create preferences",
				})
				return
			}
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to fetch preferences",
			})
			return
		}
	} else {
		// Update existing preferences
		mappers.ApplyPreferenceUpdates(&preferences, req)
		if err := m.db.DB.Save(&preferences).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to update preferences",
			})
			return
		}
	}

	c.JSON(http.StatusOK, mappers.ToPreferencesResponse(preferences))
}
