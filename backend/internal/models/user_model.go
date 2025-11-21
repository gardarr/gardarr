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

// AuthResponse represents the response body for authentication operations
type AuthResponse struct {
	User *UserResponse `json:"user"`
}

// SessionResponse represents the response body for session information
type SessionResponse struct {
	ID        string    `json:"id"`
	UserAgent string    `json:"user_agent"`
	IPAddress string    `json:"ip_address"`
	CreatedAt time.Time `json:"created_at"`
	ExpiresAt time.Time `json:"expires_at"`
}

// TorrentDisplayModeResponse represents the response body for torrent display mode
type TorrentDisplayModeResponse struct {
	DisplayMode string `json:"display_mode"`
}

// PreferencesResponse represents the response body for user preferences
type PreferencesResponse struct {
	TorrentDisplayMode          string `json:"torrent_display_mode"`
	Compact                     bool   `json:"compact"`
	BackgroundImageBlurIntensity int    `json:"background_image_blur_intensity"`
}
