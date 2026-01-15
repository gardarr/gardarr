package event

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/jfxdev/gardarr/internal/entities"
	"github.com/jfxdev/gardarr/internal/infra/database"
	"github.com/jfxdev/gardarr/internal/models"
	"gorm.io/gorm/clause"
)

type Repository struct {
	db *database.Database
}

const (
	// Query conditions for task state operations
	taskStateByAgentAndHash = "agent_id = ? AND hash = ?"

	// Batch size for loading task states to prevent memory spikes
	taskStateLoadBatchSize = 1000
)

func NewRepository(db *database.Database) *Repository {
	return &Repository{db: db}
}

// CreateEvent creates a new event in the database
func (r *Repository) CreateEvent(ctx context.Context, event *entities.Event) error {
	var metadataJSON string
	if len(event.Metadata) > 0 {
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

// SaveTaskState saves or updates a task state in the database atomically
// Uses UPSERT to avoid TOCTOU race conditions
func (r *Repository) SaveTaskState(ctx context.Context, agentID uuid.UUID, hash string, state string, progress float64, updatedAt time.Time) error {
	taskState := &models.TaskState{
		AgentID:   agentID,
		Hash:      hash,
		State:     state,
		Progress:  progress,
		UpdatedAt: updatedAt,
	}

	// Atomic upsert: insert or update on conflict
	return r.db.DB.WithContext(ctx).
		Clauses(clause.OnConflict{
			Columns: []clause.Column{
				{Name: "agent_id"},
				{Name: "hash"},
			},
			DoUpdates: clause.AssignmentColumns([]string{"state", "progress", "updated_at"}),
		}).
		Create(taskState).Error
}

// LoadTaskStates loads all task states for a specific agent from the database
func (r *Repository) LoadTaskStates(ctx context.Context, agentID uuid.UUID) (map[string]*entities.TaskState, error) {
	var states []models.TaskState
	if err := r.db.DB.WithContext(ctx).
		Where("agent_id = ?", agentID).
		Find(&states).Error; err != nil {
		return nil, err
	}

	result := make(map[string]*entities.TaskState, len(states))
	for _, s := range states {
		result[s.Hash] = &entities.TaskState{
			AgentID:   s.AgentID,
			Hash:      s.Hash,
			State:     s.State,
			Progress:  s.Progress,
			UpdatedAt: s.UpdatedAt,
		}
	}

	return result, nil
}

// LoadAllTaskStates loads all task states from the database grouped by agent
// Uses batching to prevent memory spikes during startup with large datasets
func (r *Repository) LoadAllTaskStates(ctx context.Context) (map[uuid.UUID]map[string]*entities.TaskState, error) {
	result := make(map[uuid.UUID]map[string]*entities.TaskState)
	offset := 0

	for {
		var batch []models.TaskState
		err := r.db.DB.WithContext(ctx).
			Order("agent_id, hash").
			Limit(taskStateLoadBatchSize).
			Offset(offset).
			Find(&batch).Error

		if err != nil {
			return nil, err
		}

		// No more records
		if len(batch) == 0 {
			break
		}

		// Process batch
		for _, s := range batch {
			if result[s.AgentID] == nil {
				result[s.AgentID] = make(map[string]*entities.TaskState)
			}
			result[s.AgentID][s.Hash] = &entities.TaskState{
				AgentID:   s.AgentID,
				Hash:      s.Hash,
				State:     s.State,
				Progress:  s.Progress,
				UpdatedAt: s.UpdatedAt,
			}
		}

		// Move to next batch
		offset += taskStateLoadBatchSize

		// If we got fewer records than batch size, we're done
		if len(batch) < taskStateLoadBatchSize {
			break
		}

		// Log progress for large datasets
		if offset%5000 == 0 {
			slog.Info("loading task states in progress",
				"loaded", offset,
				"agents", len(result),
			)
		}
	}

	return result, nil
}

// DeleteTaskState removes a task state from the database
func (r *Repository) DeleteTaskState(ctx context.Context, agentID uuid.UUID, hash string) error {
	return r.db.DB.WithContext(ctx).
		Where(taskStateByAgentAndHash, agentID, hash).
		Delete(&models.TaskState{}).Error
}

// DeleteOldTaskStates deletes task states older than the specified date
func (r *Repository) DeleteOldTaskStates(ctx context.Context, olderThan time.Time) error {
	return r.db.DB.WithContext(ctx).
		Where("updated_at < ?", olderThan).
		Delete(&models.TaskState{}).Error
}

// HasCompletedEvent checks if a torrent.completed event already exists for the given task hash
func (r *Repository) HasCompletedEvent(ctx context.Context, agentID uuid.UUID, taskHash string) (bool, error) {
	var count int64
	err := r.db.DB.WithContext(ctx).
		Model(&models.Event{}).
		Where("agent_id = ? AND task_hash = ? AND type = ?", agentID, taskHash, "torrent.completed").
		Count(&count).Error
	return count > 0, err
}
