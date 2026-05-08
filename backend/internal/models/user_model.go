package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type User struct {
	UUID         uuid.UUID `gorm:"type:uuid;primaryKey;uniqueIndex"`
	Username     string    `gorm:"size:100;uniqueIndex:idx_username,where:username != ''"`
	Email        string    `gorm:"size:255;uniqueIndex;not null"`
	PasswordHash string    `gorm:"size:255;not null"`
	Salt         string    `gorm:"size:255;not null"`
	Role         string    `gorm:"size:50;default:'user'"`
	Founder      bool
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

func (u *User) BeforeCreate(tx *gorm.DB) (err error) {
	if u.UUID == uuid.Nil {
		u.UUID = uuid.New()
	}

	u.CreatedAt = time.Now()
	u.UpdatedAt = time.Now()
	return
}

func (u *User) BeforeUpdate(tx *gorm.DB) (err error) {
	u.UpdatedAt = time.Now()
	return
}

// UserResponse represents the response body for user operations
type UserResponse struct {
	UUID      string    `json:"uuid"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	Founder   bool      `json:"founder"`
	CreatedAt time.Time `json:"created_at"`
}

// ListUsersResponse represents the response body for listing users
type ListUsersResponse struct {
	Users []*UserResponse `json:"users"`
	Total int             `json:"total"`
}

// TorrentDisplayModeResponse represents the response body for torrent display mode
type TorrentDisplayModeResponse struct {
	DisplayMode string `json:"display_mode"`
}

// PreferencesResponse represents the response body for user preferences
type PreferencesResponse struct {
	TorrentDisplayMode           string `json:"torrent_display_mode"`
	Compact                      bool   `json:"compact"`
	BackgroundImageBlurIntensity int    `json:"background_image_blur_intensity"`
	ActiveColorPalette           int    `json:"active_color_palette"`
	// Color Palette 1
	ColorPalette1Primary   string `json:"color_palette_1_primary"`
	ColorPalette1Secondary string `json:"color_palette_1_secondary"`
	ColorPalette1Accent    string `json:"color_palette_1_accent"`
	ColorPalette1Muted     string `json:"color_palette_1_muted"`
	// Color Palette 2
	ColorPalette2Primary   string `json:"color_palette_2_primary"`
	ColorPalette2Secondary string `json:"color_palette_2_secondary"`
	ColorPalette2Accent    string `json:"color_palette_2_accent"`
	ColorPalette2Muted     string `json:"color_palette_2_muted"`
	// Color Palette 3
	ColorPalette3Primary   string `json:"color_palette_3_primary"`
	ColorPalette3Secondary string `json:"color_palette_3_secondary"`
	ColorPalette3Accent    string `json:"color_palette_3_accent"`
	ColorPalette3Muted     string `json:"color_palette_3_muted"`
}
