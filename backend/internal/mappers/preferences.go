package mappers

import (
	"github.com/google/uuid"
	"github.com/jfxdev/gardarr/internal/models"
	"github.com/jfxdev/gardarr/internal/schemas"
)

// ToPreferencesResponse converts UserPreferences model to PreferencesResponse
func ToPreferencesResponse(prefs models.UserPreferences) models.PreferencesResponse {
	return models.PreferencesResponse{
		TorrentDisplayMode:           prefs.TorrentDisplayMode,
		Compact:                      prefs.Compact,
		BackgroundImageBlurIntensity: prefs.BackgroundImageBlurIntensity,
		ActiveColorPalette:           prefs.ActiveColorPalette,
		ColorPalette1Primary:         prefs.ColorPalette1Primary,
		ColorPalette1Secondary:       prefs.ColorPalette1Secondary,
		ColorPalette1Accent:          prefs.ColorPalette1Accent,
		ColorPalette1Muted:           prefs.ColorPalette1Muted,
		ColorPalette2Primary:         prefs.ColorPalette2Primary,
		ColorPalette2Secondary:       prefs.ColorPalette2Secondary,
		ColorPalette2Accent:          prefs.ColorPalette2Accent,
		ColorPalette2Muted:           prefs.ColorPalette2Muted,
		ColorPalette3Primary:         prefs.ColorPalette3Primary,
		ColorPalette3Secondary:       prefs.ColorPalette3Secondary,
		ColorPalette3Accent:          prefs.ColorPalette3Accent,
		ColorPalette3Muted:           prefs.ColorPalette3Muted,
	}
}

// GetDefaultPreferences returns a new UserPreferences model with default values
func GetDefaultPreferences(userUUID uuid.UUID) models.UserPreferences {
	return models.UserPreferences{
		UUID:                         uuid.New(),
		UserUUID:                     userUUID,
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
}

// GetDefaultPreferencesResponse returns a PreferencesResponse with default values
func GetDefaultPreferencesResponse() models.PreferencesResponse {
	defaults := GetDefaultPreferences(uuid.Nil)
	return ToPreferencesResponse(defaults)
}

// ApplyPreferenceUpdates applies updates from request to preferences model
func ApplyPreferenceUpdates(prefs *models.UserPreferences, req schemas.UpdatePreferencesRequest) {
	if req.TorrentDisplayMode != nil {
		prefs.TorrentDisplayMode = *req.TorrentDisplayMode
	}
	if req.Compact != nil {
		prefs.Compact = *req.Compact
	}
	if req.BackgroundImageBlurIntensity != nil {
		prefs.BackgroundImageBlurIntensity = *req.BackgroundImageBlurIntensity
	}
	if req.ActiveColorPalette != nil {
		prefs.ActiveColorPalette = *req.ActiveColorPalette
	}
	// Color Palette 1
	if req.ColorPalette1Primary != nil {
		prefs.ColorPalette1Primary = *req.ColorPalette1Primary
	}
	if req.ColorPalette1Secondary != nil {
		prefs.ColorPalette1Secondary = *req.ColorPalette1Secondary
	}
	if req.ColorPalette1Accent != nil {
		prefs.ColorPalette1Accent = *req.ColorPalette1Accent
	}
	if req.ColorPalette1Muted != nil {
		prefs.ColorPalette1Muted = *req.ColorPalette1Muted
	}
	// Color Palette 2
	if req.ColorPalette2Primary != nil {
		prefs.ColorPalette2Primary = *req.ColorPalette2Primary
	}
	if req.ColorPalette2Secondary != nil {
		prefs.ColorPalette2Secondary = *req.ColorPalette2Secondary
	}
	if req.ColorPalette2Accent != nil {
		prefs.ColorPalette2Accent = *req.ColorPalette2Accent
	}
	if req.ColorPalette2Muted != nil {
		prefs.ColorPalette2Muted = *req.ColorPalette2Muted
	}
	// Color Palette 3
	if req.ColorPalette3Primary != nil {
		prefs.ColorPalette3Primary = *req.ColorPalette3Primary
	}
	if req.ColorPalette3Secondary != nil {
		prefs.ColorPalette3Secondary = *req.ColorPalette3Secondary
	}
	if req.ColorPalette3Accent != nil {
		prefs.ColorPalette3Accent = *req.ColorPalette3Accent
	}
	if req.ColorPalette3Muted != nil {
		prefs.ColorPalette3Muted = *req.ColorPalette3Muted
	}
}
