package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// TaskMetadata represents task metadata stored in database
type TaskMetadata struct {
	UUID            uuid.UUID `gorm:"type:uuid;primaryKey"`
	TaskHash        string    `gorm:"type:varchar(40);not null;uniqueIndex"`
	ImagePath       string    `gorm:"type:text"`
	Name            string    `gorm:"type:varchar(255)"`
	ReleaseDate     string    `gorm:"type:varchar(50)"`
	Description     string    `gorm:"type:text"`
	ImagePositionY  float64   `gorm:"type:float;default:50"`
	ImageBrightness float64   `gorm:"type:float;default:65"`
	CreatedAt       time.Time `gorm:"autoCreateTime"`
	UpdatedAt       time.Time `gorm:"autoUpdateTime"`
}

func (t *TaskMetadata) BeforeCreate(tx *gorm.DB) (err error) {
	if t.UUID == uuid.Nil {
		t.UUID = uuid.New()
	}
	return nil
}

// WorkerImageStats represents image storage stats for a single worker
type WorkerImageStats struct {
	WorkerID       string `json:"worker_id"`
	WorkerName     string `json:"worker_name"`
	IsRemoved      bool   `json:"is_removed"`
	ImageCount     int    `json:"image_count"`
	TotalSizeBytes int64  `json:"total_size_bytes"`
}

// ImageStorageStatsResponse represents the full image storage stats response
type ImageStorageStatsResponse struct {
	Workers         []WorkerImageStats `json:"workers"`
	OrphanCount     int                `json:"orphan_count"`
	OrphanSizeBytes int64              `json:"orphan_size_bytes"`
	TotalSizeBytes  int64              `json:"total_size_bytes"`
	TotalImageCount int                `json:"total_image_count"`
}

// TaskMetadataResponse represents the JSON response for task metadata
type TaskMetadataResponse struct {
	UUID            uuid.UUID `json:"uuid"`
	TaskHash        string    `json:"task_hash"`
	ImageURL        string    `json:"image_url,omitempty"`
	ThumbnailURL    string    `json:"thumbnail_url,omitempty"`
	Name            string    `json:"name,omitempty"`
	ReleaseDate     string    `json:"release_date,omitempty"`
	Description     string    `json:"description,omitempty"`
	Warning         string    `json:"warning,omitempty"`
	WarningReason   string    `json:"warning_reason,omitempty"`
	ImagePositionY  float64   `json:"image_position_y,omitempty"`
	ImageBrightness float64   `json:"image_brightness,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}
