package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Session struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey;uniqueIndex"`
	UserUUID  uuid.UUID `gorm:"type:uuid;not null;index"`
	Token     string    `gorm:"size:255;uniqueIndex;not null"`
	UserAgent string    `gorm:"size:500"`
	IPAddress string    `gorm:"size:45"`
	ExpiresAt time.Time `gorm:"not null;index"`
	CreatedAt time.Time
	UpdatedAt time.Time

	// Relations
	User User `gorm:"foreignKey:UserUUID;references:UUID"`
}

func (s *Session) BeforeCreate(tx *gorm.DB) (err error) {
	if s.ID == uuid.Nil {
		s.ID = uuid.New()
	}
	return
}

// IsExpired checks if the session has expired
func (s *Session) IsExpired() bool {
	return time.Now().After(s.ExpiresAt)
}
