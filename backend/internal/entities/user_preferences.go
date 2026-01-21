package entities

import (
	"time"

	"github.com/google/uuid"
)

type UserPreferences struct {
	UUID                         uuid.UUID
	UserUUID                     uuid.UUID
	TorrentDisplayMode           string
	Compact                      bool
	BackgroundImageBlurIntensity int
	ActiveColorPalette           int
	// Color Palette 1
	ColorPalette1Primary   string
	ColorPalette1Secondary string
	ColorPalette1Accent    string
	ColorPalette1Muted     string
	// Color Palette 2
	ColorPalette2Primary   string
	ColorPalette2Secondary string
	ColorPalette2Accent    string
	ColorPalette2Muted     string
	// Color Palette 3
	ColorPalette3Primary   string
	ColorPalette3Secondary string
	ColorPalette3Accent    string
	ColorPalette3Muted     string
	CreatedAt              time.Time
	UpdatedAt              time.Time
}
