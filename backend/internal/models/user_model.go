package models

import (
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type User struct {
	UUID     uuid.UUID `gorm:"type:uuid;primaryKey;uniqueIndex"`
	Username string    `gorm:"size:100;uniqueIndex"`
}

func (u *User) BeforeCreate(tx *gorm.DB) (err error) {
	if u.UUID == uuid.Nil {
		u.UUID = uuid.New()
	}
	return
}
