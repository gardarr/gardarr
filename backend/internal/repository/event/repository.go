package event

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/gardarr/gardarr/internal/entities"
	"github.com/gardarr/gardarr/internal/infra/database"
	"github.com/gardarr/gardarr/internal/models"
	"github.com/google/uuid"
)

type Repository struct {
	db *database.Database
}

func NewRepository(db *database.Database) *Repository {
	return &Repository{db: db}
}

// CreateEvent creates a new event in the database
func (r *Repository) CreateEvent(ctx context.Context, event *entities.Event) error {
	var metadataJSON string
	if event.Metadata != nil {
		data, err := json.Marshal(event.Metadata)
		if err != nil {
			return fmt.Errorf("marshal event metadata: %w", err)
		}
		metadataJSON = string(data)
	}

	model := &models.Event{
		UUID:      event.UUID,
		AgentID:   event.AgentID,
		Type:      string(event.Type),
		TaskHash:  event.TaskHash,
		OldValue:  event.OldValue,
		NewValue:  event.NewValue,
		Metadata:  metadataJSON,
		CreatedAt: event.CreatedAt,
	}

	return r.db.DB.WithContext(ctx).Create(model).Error
}

// ListEvents retrieves events with optional filters
func (r *Repository) ListEvents(ctx context.Context, agentID *uuid.UUID, eventType *string, limit int, offset int) ([]*entities.Event, int64, error) {
	var events []models.Event
	var total int64

	query := r.db.DB.WithContext(ctx).Model(&models.Event{})

	// Apply filters
	if agentID != nil {
		query = query.Where("agent_id = ?", agentID)
	}
	if eventType != nil && *eventType != "" {
		query = query.Where("type = ?", *eventType)
	}

	// Get total count
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// Get events with pagination
	if err := query.Order("created_at DESC").Limit(limit).Offset(offset).Find(&events).Error; err != nil {
		return nil, 0, err
	}

	// Convert to entities
	result := make([]*entities.Event, len(events))
	for i, e := range events {
		var metadata map[string]interface{}
		if e.Metadata != "" {
			if err := json.Unmarshal([]byte(e.Metadata), &metadata); err != nil {
				slog.Warn("failed to unmarshal event metadata", "error", err, "event_uuid", e.UUID.String())
			}
		}

		result[i] = &entities.Event{
			UUID:      e.UUID,
			AgentID:   e.AgentID,
			Type:      e.Type,
			TaskHash:  e.TaskHash,
			OldValue:  e.OldValue,
			NewValue:  e.NewValue,
			Metadata:  metadata,
			CreatedAt: e.CreatedAt,
		}
	}

	return result, total, nil
}

// GetEventByUUID retrieves an event by its UUID
func (r *Repository) GetEventByUUID(ctx context.Context, uuid uuid.UUID) (*entities.Event, error) {
	var model models.Event
	if err := r.db.DB.WithContext(ctx).Where("uuid = ?", uuid).First(&model).Error; err != nil {
		return nil, err
	}

	var metadata map[string]interface{}
	if model.Metadata != "" {
		if err := json.Unmarshal([]byte(model.Metadata), &metadata); err != nil {
			slog.Warn("failed to unmarshal event metadata", "error", err, "event_uuid", model.UUID.String())
		}
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
	}, nil
}

// DeleteOldEvents deletes events older than the specified date
func (r *Repository) DeleteOldEvents(ctx context.Context, olderThan time.Time) error {
	return r.db.DB.WithContext(ctx).
		Where("created_at < ?", olderThan).
		Delete(&models.Event{}).Error
}
