package models

import (
	"time"

	"gorm.io/gorm"
)

type Settings struct {
	ID              string    `gorm:"type:varchar(100);primaryKey;default:'system'"`
	Timezone        string    `gorm:"size:100;not null"`
	DefaultTheme    string    `gorm:"size:50;not null;default:'light'"`
	DefaultLanguage string    `gorm:"size:10;not null;default:'en-US'"`
	CreatedAt       time.Time `gorm:"autoCreateTime"`
	UpdatedAt       time.Time `gorm:"autoUpdateTime"`
}

func (s *Settings) BeforeCreate(tx *gorm.DB) (err error) {
	s.CreatedAt = time.Now()
	if s.ID == "" {
		s.ID = "system"
	}
	return
}

func (s *Settings) BeforeUpdate(tx *gorm.DB) (err error) {
	s.UpdatedAt = time.Now()
	return
}

// SettingsResponse represents the response body for settings operations
type SettingsResponse struct {
	Timezone        string    `json:"timezone"`
	DefaultTheme    string    `json:"default_theme"`
	DefaultLanguage string    `json:"default_language"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// TimezoneListResponse represents the response body for listing available timezones
type TimezoneListResponse struct {
	Timezones []TimezoneInfo `json:"timezones"`
	Total     int            `json:"total"`
}

// TimezoneInfo represents a single timezone option
type TimezoneInfo struct {
	Value string `json:"value"`
	Label string `json:"label"`
}
