package mappers

import (
	"github.com/gardarr/gardarr/internal/entities"
	"github.com/gardarr/gardarr/internal/models"
)

func ToAgentResponse(e *entities.Agent) *models.AgentResponse {
	if e == nil {
		return &models.AgentResponse{}
	}

	return &models.AgentResponse{
		UUID:     e.UUID.String(),
		Name:     e.Name,
		Address:  e.Address,
		Status:   e.Status,
		Error:    e.Error,
		Icon:     e.Icon,
		Color:    e.Color,
		Instance: ToInstanceResponse(e.Instance),
	}
}
