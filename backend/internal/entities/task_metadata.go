package entities

import (
	"time"

	"github.com/google/uuid"
)

// TaskMetadata represents metadata associated with a task
type TaskMetadata struct {
	UUID           uuid.UUID
	TaskHash       string
	ImagePath      string  // Path to the uploaded image file
	ImageURL       string  // URL to access the image (computed)
	ThumbnailURL   string  // URL to access thumbnail (computed)
	Description    string
	ImagePositionY float64 // Vertical position offset (0-100%)
	ImageOpacity   float64 // Image opacity (0-100%)
	CreatedAt      time.Time
	UpdatedAt      time.Time
}
