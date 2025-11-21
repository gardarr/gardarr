package mappers

import (
	"encoding/json"

	"github.com/gardarr/gardarr/internal/entities"
	"github.com/gardarr/gardarr/internal/models"
)

// ToEventResponse converts an event entity to a response model
func ToEventResponse(event *entities.Event) *models.EventResponse {
	if event == nil {
		return nil
	}

	return &models.EventResponse{
		UUID:      event.UUID.String(),
		AgentID:   event.AgentID.String(),
		Type:      event.Type,
		TaskHash:  event.TaskHash,
		OldValue:  event.OldValue,
		NewValue:  event.NewValue,
		Metadata:  event.Metadata,
		CreatedAt: event.CreatedAt,
	}
}

// ToEventEntity converts an event model to an entity
func ToEventEntity(model *models.Event) *entities.Event {
	if model == nil {
		return nil
	}

	var metadata map[string]interface{}
	if model.Metadata != "" {
		_ = json.Unmarshal([]byte(model.Metadata), &metadata)
	}

	return &entities.Event{
		UUID:      model.UUID,
		AgentID:   model.AgentID,
		Type:      model.Type,
		TaskHash:  model.TaskHash,
		OldValue:  model.OldValue,
		NewValue:  model.NewValue,
		Metadata:  metadata,
		CreatedAt: model.CreatedAt,
	}
}
