package profile

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jfxdev/gardarr/internal/entities"
	"github.com/jfxdev/gardarr/internal/infra/database"
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

// getPreferences returns the user's preferences
func (m *Module) getPreferences(c *gin.Context) {
	// Get the current user from context
	user, exists := c.Get(middlewares.UserContextKey)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Authentication required",
		})
		return
	}

	currentUser := user.(*entities.User)

	// Get or create user preferences
	var preferences models.UserPreferences
	err := m.db.DB.Where("user_uuid = ?", currentUser.UUID).First(&preferences).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			// Return default if preferences don't exist yet
			c.JSON(http.StatusOK, models.PreferencesResponse{
				TorrentDisplayMode:           "card",
				Compact:                      false,
				BackgroundImageBlurIntensity: 50,
				ActiveColorPalette:           1,
				ColorPalette1Primary:         "#3b82f6",
				ColorPalette1Secondary:       "#8b5cf6",
				ColorPalette1Accent:          "#10b981",
				ColorPalette1Muted:           "#6b7280",
				ColorPalette2Primary:         "#ef4444",
				ColorPalette2Secondary:       "#f59e0b",
				ColorPalette2Accent:          "#ec4899",
				ColorPalette2Muted:           "#78716c",
				ColorPalette3Primary:         "#06b6d4",
				ColorPalette3Secondary:       "#14b8a6",
				ColorPalette3Accent:          "#a855f7",
				ColorPalette3Muted:           "#64748b",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to fetch preferences",
		})
		return
	}

	c.JSON(http.StatusOK, models.PreferencesResponse{
		TorrentDisplayMode:           preferences.TorrentDisplayMode,
		Compact:                      preferences.Compact,
		BackgroundImageBlurIntensity: preferences.BackgroundImageBlurIntensity,
		ActiveColorPalette:           preferences.ActiveColorPalette,
		ColorPalette1Primary:         preferences.ColorPalette1Primary,
		ColorPalette1Secondary:       preferences.ColorPalette1Secondary,
		ColorPalette1Accent:          preferences.ColorPalette1Accent,
		ColorPalette1Muted:           preferences.ColorPalette1Muted,
		ColorPalette2Primary:         preferences.ColorPalette2Primary,
		ColorPalette2Secondary:       preferences.ColorPalette2Secondary,
		ColorPalette2Accent:          preferences.ColorPalette2Accent,
		ColorPalette2Muted:           preferences.ColorPalette2Muted,
		ColorPalette3Primary:         preferences.ColorPalette3Primary,
		ColorPalette3Secondary:       preferences.ColorPalette3Secondary,
		ColorPalette3Accent:          preferences.ColorPalette3Accent,
		ColorPalette3Muted:           preferences.ColorPalette3Muted,
	})
}

// getTorrentDisplayMode returns the user's torrent display mode preference (legacy endpoint)
func (m *Module) getTorrentDisplayMode(c *gin.Context) {
	// Get the current user from context
	user, exists := c.Get(middlewares.UserContextKey)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Authentication required",
		})
		return
	}

	currentUser := user.(*entities.User)

	// Get or create user preferences
	var preferences models.UserPreferences
	err := m.db.DB.Where("user_uuid = ?", currentUser.UUID).First(&preferences).Error
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
	user, exists := c.Get(middlewares.UserContextKey)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Authentication required",
		})
		return
	}

	currentUser := user.(*entities.User)

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
	err := m.db.DB.Where("user_uuid = ?", currentUser.UUID).First(&preferences).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			// Create new preferences with defaults
			preferences = models.UserPreferences{
				UUID:                         uuid.New(),
				UserUUID:                     currentUser.UUID,
				TorrentDisplayMode:           "card",
				Compact:                      false,
				BackgroundImageBlurIntensity: 50,
				ActiveColorPalette:           1,
				ColorPalette1Primary:         "#3b82f6",
				ColorPalette1Secondary:       "#8b5cf6",
				ColorPalette1Accent:          "#10b981",
				ColorPalette1Muted:           "#6b7280",
				ColorPalette2Primary:         "#ef4444",
				ColorPalette2Secondary:       "#f59e0b",
				ColorPalette2Accent:          "#ec4899",
				ColorPalette2Muted:           "#78716c",
				ColorPalette3Primary:         "#06b6d4",
				ColorPalette3Secondary:       "#14b8a6",
				ColorPalette3Accent:          "#a855f7",
				ColorPalette3Muted:           "#64748b",
			}
			// Apply updates from request
			if req.TorrentDisplayMode != nil {
				preferences.TorrentDisplayMode = *req.TorrentDisplayMode
			}
			if req.Compact != nil {
				preferences.Compact = *req.Compact
			}
			if req.BackgroundImageBlurIntensity != nil {
				preferences.BackgroundImageBlurIntensity = *req.BackgroundImageBlurIntensity
			}
			if req.ActiveColorPalette != nil {
				preferences.ActiveColorPalette = *req.ActiveColorPalette
			}
			// Color Palette 1
			if req.ColorPalette1Primary != nil {
				preferences.ColorPalette1Primary = *req.ColorPalette1Primary
			}
			if req.ColorPalette1Secondary != nil {
				preferences.ColorPalette1Secondary = *req.ColorPalette1Secondary
			}
			if req.ColorPalette1Accent != nil {
				preferences.ColorPalette1Accent = *req.ColorPalette1Accent
			}
			if req.ColorPalette1Muted != nil {
				preferences.ColorPalette1Muted = *req.ColorPalette1Muted
			}
			// Color Palette 2
			if req.ColorPalette2Primary != nil {
				preferences.ColorPalette2Primary = *req.ColorPalette2Primary
			}
			if req.ColorPalette2Secondary != nil {
				preferences.ColorPalette2Secondary = *req.ColorPalette2Secondary
			}
			if req.ColorPalette2Accent != nil {
				preferences.ColorPalette2Accent = *req.ColorPalette2Accent
			}
			if req.ColorPalette2Muted != nil {
				preferences.ColorPalette2Muted = *req.ColorPalette2Muted
			}
			// Color Palette 3
			if req.ColorPalette3Primary != nil {
				preferences.ColorPalette3Primary = *req.ColorPalette3Primary
			}
			if req.ColorPalette3Secondary != nil {
				preferences.ColorPalette3Secondary = *req.ColorPalette3Secondary
			}
			if req.ColorPalette3Accent != nil {
				preferences.ColorPalette3Accent = *req.ColorPalette3Accent
			}
			if req.ColorPalette3Muted != nil {
				preferences.ColorPalette3Muted = *req.ColorPalette3Muted
			}
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
		if req.TorrentDisplayMode != nil {
			preferences.TorrentDisplayMode = *req.TorrentDisplayMode
		}
		if req.Compact != nil {
			preferences.Compact = *req.Compact
		}
		if req.BackgroundImageBlurIntensity != nil {
			preferences.BackgroundImageBlurIntensity = *req.BackgroundImageBlurIntensity
		}
		if req.ActiveColorPalette != nil {
			preferences.ActiveColorPalette = *req.ActiveColorPalette
		}
		// Color Palette 1
		if req.ColorPalette1Primary != nil {
			preferences.ColorPalette1Primary = *req.ColorPalette1Primary
		}
		if req.ColorPalette1Secondary != nil {
			preferences.ColorPalette1Secondary = *req.ColorPalette1Secondary
		}
		if req.ColorPalette1Accent != nil {
			preferences.ColorPalette1Accent = *req.ColorPalette1Accent
		}
		if req.ColorPalette1Muted != nil {
			preferences.ColorPalette1Muted = *req.ColorPalette1Muted
		}
		// Color Palette 2
		if req.ColorPalette2Primary != nil {
			preferences.ColorPalette2Primary = *req.ColorPalette2Primary
		}
		if req.ColorPalette2Secondary != nil {
			preferences.ColorPalette2Secondary = *req.ColorPalette2Secondary
		}
		if req.ColorPalette2Accent != nil {
			preferences.ColorPalette2Accent = *req.ColorPalette2Accent
		}
		if req.ColorPalette2Muted != nil {
			preferences.ColorPalette2Muted = *req.ColorPalette2Muted
		}
		// Color Palette 3
		if req.ColorPalette3Primary != nil {
			preferences.ColorPalette3Primary = *req.ColorPalette3Primary
		}
		if req.ColorPalette3Secondary != nil {
			preferences.ColorPalette3Secondary = *req.ColorPalette3Secondary
		}
		if req.ColorPalette3Accent != nil {
			preferences.ColorPalette3Accent = *req.ColorPalette3Accent
		}
		if req.ColorPalette3Muted != nil {
			preferences.ColorPalette3Muted = *req.ColorPalette3Muted
		}
		if err := m.db.DB.Save(&preferences).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to update preferences",
			})
			return
		}
	}

	c.JSON(http.StatusOK, models.PreferencesResponse{
		TorrentDisplayMode:           preferences.TorrentDisplayMode,
		Compact:                      preferences.Compact,
		BackgroundImageBlurIntensity: preferences.BackgroundImageBlurIntensity,
		ActiveColorPalette:           preferences.ActiveColorPalette,
		ColorPalette1Primary:         preferences.ColorPalette1Primary,
		ColorPalette1Secondary:       preferences.ColorPalette1Secondary,
		ColorPalette1Accent:          preferences.ColorPalette1Accent,
		ColorPalette1Muted:           preferences.ColorPalette1Muted,
		ColorPalette2Primary:         preferences.ColorPalette2Primary,
		ColorPalette2Secondary:       preferences.ColorPalette2Secondary,
		ColorPalette2Accent:          preferences.ColorPalette2Accent,
		ColorPalette2Muted:           preferences.ColorPalette2Muted,
		ColorPalette3Primary:         preferences.ColorPalette3Primary,
		ColorPalette3Secondary:       preferences.ColorPalette3Secondary,
		ColorPalette3Accent:          preferences.ColorPalette3Accent,
		ColorPalette3Muted:           preferences.ColorPalette3Muted,
	})
}
