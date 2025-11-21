package mappers

import (
	"github.com/gardarr/gardarr/internal/entities"
	"github.com/gardarr/gardarr/internal/models"
)

// ToTaskMetadataResponse converts entity to response model
func ToTaskMetadataResponse(e *entities.TaskMetadata) *models.TaskMetadataResponse {
	if e == nil {
		return nil
	}

	return &models.TaskMetadataResponse{
		UUID:           e.UUID,
		TaskHash:       e.TaskHash,
		ImageURL:       e.ImageURL,
		ThumbnailURL:   e.ThumbnailURL,
		Description:    e.Description,
		ImagePositionY: e.ImagePositionY,
		ImageOpacity:   e.ImageOpacity,
		CreatedAt:      e.CreatedAt,
		UpdatedAt:      e.UpdatedAt,
	}
}
