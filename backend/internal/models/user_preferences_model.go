package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type UserPreferences struct {
	UUID                        uuid.UUID `gorm:"type:uuid;primaryKey"`
	UserUUID                    uuid.UUID `gorm:"type:uuid;not null;uniqueIndex"`
	TorrentDisplayMode          string    `gorm:"size:20;default:'default'"`
	Compact                     bool      `gorm:"default:false"`
	BackgroundImageBlurIntensity int       `gorm:"default:50"`
	CreatedAt                   time.Time
	UpdatedAt                   time.Time
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
