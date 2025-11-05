package settings

import (
	"errors"
	"net/http"

	"github.com/gardarr/gardarr/internal/infra/database"
	"github.com/gardarr/gardarr/internal/middlewares"
	"github.com/gardarr/gardarr/internal/models"
	"github.com/gardarr/gardarr/internal/schemas"
	settingsService "github.com/gardarr/gardarr/internal/services/settings"
	"github.com/gin-gonic/gin"
)

// Module holds settings routes configuration
type Module struct {
	group           *gin.RouterGroup
	settingsService *settingsService.Service
	db              *database.Database
}

// NewModule creates a new settings module
func NewModule(router *gin.RouterGroup, db *database.Database) *Module {
	return &Module{
		group:           router.Group("/settings"),
		settingsService: settingsService.NewService(db),
		db:              db,
	}
}

// Register registers all settings routes
func (m *Module) Register() {
	// Protected routes - require authentication
	protected := m.group.Group("")
	protected.Use(middlewares.SessionMiddleware(m.db))
	protected.Use(middlewares.RequireAdminRole())

	protected.GET("/timezone", m.getTimezone)
	protected.PUT("/timezone", m.updateTimezone)
	protected.GET("/timezones", m.listTimezones)
	protected.GET("/theme", m.getTheme)
	protected.PUT("/theme", m.updateTheme)
	protected.GET("/language", m.getLanguage)
	protected.PUT("/language", m.updateLanguage)
}

// getTimezone retrieves the current system timezone
func (m *Module) getTimezone(c *gin.Context) {
	settings, err := m.settingsService.GetSettings(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to retrieve timezone",
		})
		return
	}

	resp := gin.H{
		"timezone":   settings.Timezone,
		"updated_at": settings.UpdatedAt,
	}

	c.JSON(http.StatusOK, resp)
}

// updateTimezone updates the system timezone
func (m *Module) updateTimezone(c *gin.Context) {
	var body schemas.TimezoneUpdateRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Validation failed",
			"details": err.Error(),
		})
		return
	}

	if err := m.settingsService.UpdateTimezone(c.Request.Context(), body.Timezone); err != nil {
		statusCode := http.StatusInternalServerError
		if errors.Is(err, settingsService.ErrInvalidTimezone) || errors.Is(err, settingsService.ErrInvalidTimezoneLocation) {
			statusCode = http.StatusBadRequest
		}
		c.JSON(statusCode, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Timezone updated successfully",
	})
}

// listTimezones returns the list of available timezones
func (m *Module) listTimezones(c *gin.Context) {
	timezones := m.settingsService.GetAvailableTimezones()
	resp := models.TimezoneListResponse{
		Timezones: timezones,
		Total:     len(timezones),
	}

	c.JSON(http.StatusOK, resp)
}

// getTheme retrieves the current system theme
func (m *Module) getTheme(c *gin.Context) {
	settings, err := m.settingsService.GetSettings(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to retrieve theme",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"default_theme": settings.DefaultTheme,
		"updated_at":    settings.UpdatedAt,
	})
}

// updateTheme updates the system default theme
func (m *Module) updateTheme(c *gin.Context) {
	var body schemas.ThemeUpdateRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Validation failed",
			"details": err.Error(),
		})
		return
	}

	if err := m.settingsService.UpdateTheme(c.Request.Context(), body.Theme); err != nil {
		statusCode := http.StatusInternalServerError
		if errors.Is(err, settingsService.ErrInvalidTheme) {
			statusCode = http.StatusBadRequest
		}
		c.JSON(statusCode, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Theme updated successfully",
	})
}

// getLanguage retrieves the current system language
func (m *Module) getLanguage(c *gin.Context) {
	settings, err := m.settingsService.GetSettings(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to retrieve language",
		})
		return
	}

	resp := models.SettingsResponse{
		DefaultLanguage: settings.DefaultLanguage,
		UpdatedAt:       settings.UpdatedAt,
	}

	c.JSON(http.StatusOK, resp)
}

// updateLanguage updates the system default language
func (m *Module) updateLanguage(c *gin.Context) {
	var body schemas.LanguageUpdateRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Validation failed",
			"details": err.Error(),
		})
		return
	}

	if err := m.settingsService.UpdateLanguage(c.Request.Context(), body.Language); err != nil {
		statusCode := http.StatusInternalServerError
		if errors.Is(err, settingsService.ErrInvalidLanguage) {
			statusCode = http.StatusBadRequest
		}
		c.JSON(statusCode, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Language updated successfully",
	})
}
