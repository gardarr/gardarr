package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// TaskMetadata represents task metadata stored in database
type TaskMetadata struct {
	UUID           uuid.UUID `gorm:"type:uuid;primaryKey"`
	TaskHash       string    `gorm:"type:varchar(40);not null;uniqueIndex"`
	ImagePath      string    `gorm:"type:text"`
	Description    string    `gorm:"type:text"`
	ImagePositionY float64   `gorm:"type:float;default:50"`
	ImageOpacity   float64   `gorm:"type:float;default:65"`
	CreatedAt      time.Time `gorm:"autoCreateTime"`
	UpdatedAt      time.Time `gorm:"autoUpdateTime"`
}

func (t *TaskMetadata) BeforeCreate(tx *gorm.DB) (err error) {
	if t.UUID == uuid.Nil {
		t.UUID = uuid.New()
	}
	return nil
}

// TaskMetadataResponse represents the JSON response for task metadata
type TaskMetadataResponse struct {
	UUID           uuid.UUID `json:"uuid"`
	TaskHash       string    `json:"task_hash"`
	ImageURL       string    `json:"image_url,omitempty"`
	ThumbnailURL   string    `json:"thumbnail_url,omitempty"`
	Description    string    `json:"description,omitempty"`
	ImagePositionY float64   `json:"image_position_y,omitempty"`
	ImageOpacity   float64   `json:"image_opacity,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}
