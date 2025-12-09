package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// TaskState represents the last known state of a task in the database
type TaskState struct {
	AgentID   uuid.UUID `gorm:"type:uuid;primaryKey;index;not null"`
	Hash      string    `gorm:"type:varchar(255);primaryKey;index;not null"`
	State     string    `gorm:"type:varchar(100);not null"`
	Progress  float64   `gorm:"type:real;not null;default:0"`
	UpdatedAt time.Time `gorm:"index;not null"`
}

func (ts *TaskState) BeforeCreate(tx *gorm.DB) (err error) {
	if ts.UpdatedAt.IsZero() {
		ts.UpdatedAt = time.Now().UTC()
	}
	return
}

func (ts *TaskState) BeforeUpdate(tx *gorm.DB) (err error) {
	ts.UpdatedAt = time.Now().UTC()
	return
}
