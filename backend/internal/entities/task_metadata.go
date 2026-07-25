package entities

import (
	"time"

	"github.com/google/uuid"
)

// TaskMetadata represents metadata associated with a task
type TaskMetadata struct {
	UUID            uuid.UUID
	TaskHash        string
	ImagePath       string // Path to the uploaded image file
	ImageURL        string // URL to access the image (computed)
	ThumbnailURL    string // URL to access thumbnail (computed)
	Name            string
	ReleaseDate     string
	Description     string
	ImagePositionY  float64 // Vertical position offset (0-100%)
	ImageBrightness float64 // Image brightness (0-100%)
	CreatedAt       time.Time
	UpdatedAt       time.Time
}
