package mappers

import (
	"github.com/jfxdev/gardarr/internal/entities"
	"github.com/jfxdev/gardarr/internal/models"
)

// ToTaskMetadataResponse converts entity to response model
func ToTaskMetadataResponse(e *entities.TaskMetadata) *models.TaskMetadataResponse {
	if e == nil {
		return nil
	}

	return &models.TaskMetadataResponse{
		UUID:            e.UUID,
		TaskHash:        e.TaskHash,
		ImageURL:        e.ImageURL,
		ThumbnailURL:    e.ThumbnailURL,
		Name:            e.Name,
		ReleaseDate:     e.ReleaseDate,
		Description:     e.Description,
		ImagePositionY:  e.ImagePositionY,
		ImageBrightness: e.ImageBrightness,
		CreatedAt:       e.CreatedAt,
		UpdatedAt:       e.UpdatedAt,
	}
}
