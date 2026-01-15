package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type UserPreferences struct {
	UUID                         uuid.UUID `gorm:"type:uuid;primaryKey"`
	UserUUID                     uuid.UUID `gorm:"type:uuid;not null;uniqueIndex"`
	TorrentDisplayMode           string    `gorm:"size:20;default:'card'"`
	Compact                      bool      `gorm:"default:false"`
	BackgroundImageBlurIntensity int       `gorm:"default:50"`
	ActiveColorPalette           int       `gorm:"default:1"` // 1, 2, or 3
	// Color Palette 1
	ColorPalette1Primary   string `gorm:"size:7;default:'#3b82f6'"` // Blue
	ColorPalette1Secondary string `gorm:"size:7;default:'#8b5cf6'"` // Purple
	ColorPalette1Accent    string `gorm:"size:7;default:'#10b981'"` // Green
	ColorPalette1Muted     string `gorm:"size:7;default:'#6b7280'"` // Gray
	// Color Palette 2
	ColorPalette2Primary   string `gorm:"size:7;default:'#ef4444'"` // Red
	ColorPalette2Secondary string `gorm:"size:7;default:'#f59e0b'"` // Amber
	ColorPalette2Accent    string `gorm:"size:7;default:'#ec4899'"` // Pink
	ColorPalette2Muted     string `gorm:"size:7;default:'#78716c'"` // Stone
	// Color Palette 3
	ColorPalette3Primary   string `gorm:"size:7;default:'#06b6d4'"` // Cyan
	ColorPalette3Secondary string `gorm:"size:7;default:'#14b8a6'"` // Teal
	ColorPalette3Accent    string `gorm:"size:7;default:'#a855f7'"` // Purple
	ColorPalette3Muted     string `gorm:"size:7;default:'#64748b'"` // Slate
	CreatedAt              time.Time
	UpdatedAt              time.Time
}

func (up *UserPreferences) BeforeCreate(tx *gorm.DB) (err error) {
	if up.UUID == uuid.Nil {
		up.UUID = uuid.New()
	}

	up.CreatedAt = time.Now()
	up.UpdatedAt = time.Now()
	return
}

func (up *UserPreferences) BeforeUpdate(tx *gorm.DB) (err error) {
	up.UpdatedAt = time.Now()
	return
}
