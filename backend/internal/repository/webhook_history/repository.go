package webhook_history

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jfxdev/gardarr/internal/entities"
	"github.com/jfxdev/gardarr/internal/infra/database"
	"github.com/jfxdev/gardarr/internal/models"
	"gorm.io/gorm"
)

type Repository struct {
	db *database.Database
}

func NewRepository(db *database.Database) *Repository {
	return &Repository{
		db: db,
	}
}

// CreateWebhookHistory inserts a new webhook history record into the database
func (r *Repository) CreateWebhookHistory(ctx context.Context, history entities.WebhookHistory) (*entities.WebhookHistory, error) {
	model := &models.WebhookHistory{
		UUID:         history.UUID,
		WebhookID:    history.WebhookID,
		TaskHash:     history.TaskHash,
		TaskName:     history.TaskName,
		TaskStatus:   history.TaskStatus,
		StatusCode:   history.StatusCode,
		ResponseBody: history.ResponseBody,
		RequestBody:  history.RequestBody,
		Error:        history.Error,
	}

	if err := r.db.DB.WithContext(ctx).Create(model).Error; err != nil {
		return nil, err
	}

	return toWebhookHistory(*model), nil
}

// ListWebhookHistory retrieves webhook history records with pagination
func (r *Repository) ListWebhookHistory(ctx context.Context, webhookID *uuid.UUID, limit int, offset int) ([]*entities.WebhookHistory, error) {
	var models []models.WebhookHistory
	query := r.db.DB.WithContext(ctx).Order("created_at DESC")

	if webhookID != nil {
		query = query.Where("webhook_id = ?", *webhookID)
	}

	if limit > 0 {
		query = query.Limit(limit)
	}
	if offset > 0 {
		query = query.Offset(offset)
	}

	if err := query.Find(&models).Error; err != nil {
		return nil, err
	}

	result := make([]*entities.WebhookHistory, len(models))
	for i, item := range models {
		result[i] = toWebhookHistory(item)
	}

	return result, nil
}

// CountWebhookHistory counts webhook history records
func (r *Repository) CountWebhookHistory(ctx context.Context, webhookID *uuid.UUID) (int64, error) {
	var count int64
	query := r.db.DB.WithContext(ctx).Model(&models.WebhookHistory{})

	if webhookID != nil {
		query = query.Where("webhook_id = ?", *webhookID)
	}

	if err := query.Count(&count).Error; err != nil {
		return 0, err
	}

	return count, nil
}

// DeleteOldWebhookHistory deletes webhook history records older than the specified duration
func (r *Repository) DeleteOldWebhookHistory(ctx context.Context, olderThan time.Duration) (int64, error) {
	cutoffTime := time.Now().Add(-olderThan)

	result := r.db.DB.WithContext(ctx).
		Where("created_at < ?", cutoffTime).
		Delete(&models.WebhookHistory{})

	if result.Error != nil {
		return 0, result.Error
	}

	return result.RowsAffected, nil
}

// GetWebhookHistoryByTaskHash retrieves webhook history records for a specific task
func (r *Repository) GetWebhookHistoryByTaskHash(ctx context.Context, taskHash string, limit int) ([]*entities.WebhookHistory, error) {
	var models []models.WebhookHistory
	query := r.db.DB.WithContext(ctx).
		Where("task_hash = ?", taskHash).
		Order("created_at DESC")

	if limit > 0 {
		query = query.Limit(limit)
	}

	if err := query.Find(&models).Error; err != nil {
		return nil, err
	}

	result := make([]*entities.WebhookHistory, len(models))
	for i, item := range models {
		result[i] = toWebhookHistory(item)
	}

	return result, nil
}

// GetWebhookHistoryByID retrieves a single webhook history record by its UUID
func (r *Repository) GetWebhookHistoryByID(ctx context.Context, id uuid.UUID) (*entities.WebhookHistory, error) {
	var model models.WebhookHistory
	if err := r.db.DB.WithContext(ctx).Where("uuid = ?", id).First(&model).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, err
		}
		return nil, err
	}

	return toWebhookHistory(model), nil
}

// toWebhookHistory converts a models.WebhookHistory to entities.WebhookHistory
func toWebhookHistory(model models.WebhookHistory) *entities.WebhookHistory {
	return &entities.WebhookHistory{
		UUID:         model.UUID,
		WebhookID:    model.WebhookID,
		TaskHash:     model.TaskHash,
		TaskName:     model.TaskName,
		TaskStatus:   model.TaskStatus,
		StatusCode:   model.StatusCode,
		ResponseBody: model.ResponseBody,
		RequestBody:  model.RequestBody,
		Error:        model.Error,
		CreatedAt:    model.CreatedAt,
	}
}
