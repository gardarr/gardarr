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
		UUID:       e.UUID.String(),
		Name:       e.Name,
		Address:    e.Address,
		Status:     e.Status,
		Error:      e.Error,
		Icon:       e.Icon,
		Color:      e.Color,
		Standalone: e.Standalone,
		Instance:   ToInstanceResponse(e.Instance),
	}
}

func ToAgentVersion(m models.AgentVersionResponse) *entities.AgentVersion {
	return &entities.AgentVersion{
		Version: m.Version,
		Commit:  m.Commit,
		Date:    m.Date,
	}
}

func ToAgentVersionResponse(e *entities.AgentVersion) *models.AgentVersionResponse {
	if e == nil {
		return &models.AgentVersionResponse{}
	}

	return &models.AgentVersionResponse{
		Version: e.Version,
		Commit:  e.Commit,
		Date:    e.Date,
	}
}
