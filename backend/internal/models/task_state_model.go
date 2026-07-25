package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// TaskState represents the last known state of a task in the database
type TaskState struct {
	WorkerID  uuid.UUID `gorm:"type:uuid;column:worker_id;primaryKey;index;not null"`
	Hash      string    `gorm:"type:varchar(255);primaryKey;index;not null"`
	Name      string    `gorm:"type:varchar(512);not null;default:''"`
	Category  string    `gorm:"type:varchar(255);not null;default:''"`
	Size      int64     `gorm:"not null;default:0"`
	State     string    `gorm:"type:varchar(100);not null"`
	Progress  float64   `gorm:"type:real;not null;default:0"`
	UpdatedAt time.Time `gorm:"index;not null"`
}

func (ts *TaskState) BeforeCreate(_ *gorm.DB) (err error) {
	if ts.UpdatedAt.IsZero() {
		ts.UpdatedAt = time.Now().UTC()
	}
	return
}

func (ts *TaskState) BeforeUpdate(_ *gorm.DB) (err error) {
	ts.UpdatedAt = time.Now().UTC()
	return
}
