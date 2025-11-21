package mappers

import (
	"github.com/jfxdev/gardarr/internal/entities"
	"github.com/jfxdev/gardarr/internal/models"
)

func ToUserResponse(e *entities.User) *models.UserResponse {
	return &models.UserResponse{
		UUID:      e.UUID.String(),
		Email:     e.Email,
		Role:      e.Role,
		Founder:   e.Founder,
		CreatedAt: e.CreatedAt,
	}
}

func ToUser(model models.User) *entities.User {
	return &entities.User{
		UUID:      model.UUID,
		Username:  model.Username,
		Email:     model.Email,
		Role:      model.Role,
		Founder:   model.Founder,
		CreatedAt: model.CreatedAt,
		UpdatedAt: model.UpdatedAt,
	}
}
