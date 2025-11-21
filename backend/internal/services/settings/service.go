package settings

import (
	"context"
	"errors"
	"slices"
	"time"

	"github.com/jfxdev/gardarr/internal/entities"
	"github.com/jfxdev/gardarr/internal/infra/database"
	"github.com/jfxdev/gardarr/internal/models"
	repositorySettings "github.com/jfxdev/gardarr/internal/repository/settings"
)

var (
	validThemes    = []string{"light", "dark", "auto"}
	validLanguages = []string{"en-US", "pt-BR"}
)

// Service error variables
var (
	ErrInvalidTimezone         = errors.New("invalid timezone")
	ErrInvalidTimezoneLocation = errors.New("invalid timezone location")
	ErrInvalidTheme            = errors.New("invalid theme")
	ErrInvalidLanguage         = errors.New("invalid language")
)

var ErrSettingsNotFound = repositorySettings.ErrSettingsNotFound

// Service handles settings business logic
type Service struct {
	repository *repositorySettings.Repository
	timezones  []models.TimezoneInfo
}

// NewService creates a new settings service
func NewService(db *database.Database) *Service {
	return &Service{
		repository: repositorySettings.NewRepository(db),
		timezones:  getAvailableTimezones(),
	}
}

// GetTimezone retrieves the current system timezone
func (s *Service) GetTimezone(ctx context.Context) (string, error) {
	settings, err := s.repository.GetSettings(ctx)
	if err != nil {
		return "", err
	}
	return settings.Timezone, nil
}

// GetSettings retrieves the current system settings
func (s *Service) GetSettings(ctx context.Context) (*entities.Settings, error) {
	return s.repository.GetSettings(ctx)
}

// UpdateTimezone updates the system timezone
func (s *Service) UpdateTimezone(ctx context.Context, timezone string) error {
	// Validate timezone
	if !s.isValidTimezone(timezone) {
		return ErrInvalidTimezone
	}

	// Validate timezone by attempting to load it
	_, err := time.LoadLocation(timezone)
	if err != nil {
		return ErrInvalidTimezoneLocation
	}

	return s.repository.UpdateTimezone(ctx, timezone)
}

// GetAvailableTimezones returns the list of available timezones
func (s *Service) GetAvailableTimezones() []models.TimezoneInfo {
	return s.timezones
}

// UpdateTheme updates the system default theme
func (s *Service) UpdateTheme(ctx context.Context, theme string) error {
	if !slices.Contains(validThemes, theme) {
		return ErrInvalidTheme
	}

	return s.repository.UpdateTheme(ctx, theme)
}

// UpdateLanguage updates the system default language
func (s *Service) UpdateLanguage(ctx context.Context, language string) error {
	if !slices.Contains(validLanguages, language) {
		return ErrInvalidLanguage
	}
	return s.repository.UpdateLanguage(ctx, language)
}

// Initialize initializes the default system settings if they don't exist
func (s *Service) Initialize(ctx context.Context) error {
	// Check if system settings already exist
	_, err := s.repository.GetSettings(ctx)
	if err == nil {
		// Settings already exist, skip initialization
		return nil
	}

	// Only proceed if error is "settings not found", otherwise return the error
	if !errors.Is(err, repositorySettings.ErrSettingsNotFound) {
		return err
	}

	// Create default settings with UTC timezone, dark theme, and en-US language
	_, err = s.repository.CreateSettings(ctx, "UTC", "dark", "en-US")
	return err
}

// isValidTimezone checks if the timezone is in the available list
func (s *Service) isValidTimezone(timezone string) bool {
	for _, tz := range s.timezones {
		if tz.Value == timezone {
			return true
		}
	}
	return false
}

// getAvailableTimezones returns a curated list of common timezones
func getAvailableTimezones() []models.TimezoneInfo {
	return []models.TimezoneInfo{
		{Value: "UTC", Label: "UTC (Coordinated Universal Time)"},
		{Value: "America/New_York", Label: "Eastern Time (US & Canada)"},
		{Value: "America/Chicago", Label: "Central Time (US & Canada)"},
		{Value: "America/Denver", Label: "Mountain Time (US & Canada)"},
		{Value: "America/Los_Angeles", Label: "Pacific Time (US & Canada)"},
		{Value: "America/Toronto", Label: "Toronto"},
		{Value: "America/Sao_Paulo", Label: "São Paulo"},
		{Value: "America/Buenos_Aires", Label: "Buenos Aires"},
		{Value: "Europe/London", Label: "London"},
		{Value: "Europe/Paris", Label: "Paris"},
		{Value: "Europe/Berlin", Label: "Berlin"},
		{Value: "Europe/Rome", Label: "Rome"},
		{Value: "Europe/Madrid", Label: "Madrid"},
		{Value: "Europe/Amsterdam", Label: "Amsterdam"},
		{Value: "Europe/Athens", Label: "Athens"},
		{Value: "Europe/Lisbon", Label: "Lisbon"},
		{Value: "Europe/Moscow", Label: "Moscow"},
		{Value: "Asia/Dubai", Label: "Dubai"},
		{Value: "Asia/Kolkata", Label: "Mumbai, New Delhi"},
		{Value: "Asia/Shanghai", Label: "Shanghai"},
		{Value: "Asia/Tokyo", Label: "Tokyo"},
		{Value: "Asia/Seoul", Label: "Seoul"},
		{Value: "Asia/Hong_Kong", Label: "Hong Kong"},
		{Value: "Asia/Singapore", Label: "Singapore"},
		{Value: "Australia/Sydney", Label: "Sydney"},
		{Value: "Australia/Melbourne", Label: "Melbourne"},
		{Value: "Pacific/Auckland", Label: "Auckland"},
	}
}
