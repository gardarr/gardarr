package webhook

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jfxdev/gardarr/internal/entities"
	"github.com/jfxdev/gardarr/internal/infra/database"
	"github.com/jfxdev/gardarr/internal/models"
	"github.com/jfxdev/gardarr/internal/repository/event_filter"
	"gorm.io/gorm"
)

// ErrNotFound is returned when a webhook is not found in the database
var ErrNotFound = errors.New("webhook not found")

type Repository struct {
	db         *database.Database
	filterRepo *event_filter.Repository
}

func NewRepository(db *database.Database) *Repository {
	return &Repository{
		db:         db,
		filterRepo: event_filter.NewRepository(db),
	}
}

// CreateWebhook inserts a new webhook into the database
func (r *Repository) CreateWebhook(ctx context.Context, webhook entities.Webhook) (*entities.Webhook, error) {
	var result *entities.Webhook

	// Execute webhook creation and filter creation in a single transaction
	err := r.db.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		model := &models.Webhook{
			UUID:               webhook.UUID,
			URL:                webhook.URL,
			InsecureSkipVerify: webhook.InsecureSkipVerify,
			Enabled:            webhook.Enabled,
			TimeoutSeconds:     webhook.TimeoutSeconds,
		}

		// Use Select to ensure zero values (like false) are inserted
		if err := tx.Select("UUID", "URL", "InsecureSkipVerify", "Enabled", "TimeoutSeconds").Create(model).Error; err != nil {
			return err
		}

		result = toWebhook(*model)

		// Create filter if provided
		if webhook.Filter != nil {
			webhook.Filter.IntegrationID = result.UUID
			webhook.Filter.IntegrationType = entities.EventFilterTypeWebhook
			createdFilter, err := r.filterRepo.CreateEventFilterTx(ctx, tx, *webhook.Filter)
			if err != nil {
				return err
			}
			result.Filter = createdFilter
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return result, nil
}

// ListWebhooks retrieves all webhooks from the database
func (r *Repository) ListWebhooks(ctx context.Context) ([]*entities.Webhook, error) {
	var models []models.Webhook
	if err := r.db.DB.WithContext(ctx).Order("created_at DESC").Find(&models).Error; err != nil {
		return nil, err
	}

	result := make([]*entities.Webhook, len(models))
	for i, item := range models {
		webhook := toWebhook(item)

		// Load filter (1:1 relationship)
		filter, err := r.filterRepo.GetFilterByIntegration(ctx, webhook.UUID, entities.EventFilterTypeWebhook)
		if err != nil {
			return nil, err
		}
		webhook.Filter = filter

		result[i] = webhook
	}

	return result, nil
}

// ListEnabledWebhooks retrieves all enabled webhooks from the database
func (r *Repository) ListEnabledWebhooks(ctx context.Context) ([]*entities.Webhook, error) {
	var models []models.Webhook
	if err := r.db.DB.WithContext(ctx).Where("enabled = ?", true).Order("created_at DESC").Find(&models).Error; err != nil {
		return nil, err
	}

	result := make([]*entities.Webhook, len(models))
	for i, item := range models {
		webhook := toWebhook(item)

		// Load filter (1:1 relationship)
		filter, err := r.filterRepo.GetFilterByIntegration(ctx, webhook.UUID, entities.EventFilterTypeWebhook)
		if err != nil {
			return nil, err
		}
		webhook.Filter = filter

		result[i] = webhook
	}

	return result, nil
}

// GetWebhookByUUID retrieves a single webhook by its UUID
func (r *Repository) GetWebhookByUUID(ctx context.Context, id uuid.UUID) (*entities.Webhook, error) {
	var model models.Webhook
	if err := r.db.DB.WithContext(ctx).Where("uuid = ?", id).First(&model).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	webhook := toWebhook(model)

	// Load filter (1:1 relationship)
	filter, err := r.filterRepo.GetFilterByIntegration(ctx, webhook.UUID, entities.EventFilterTypeWebhook)
	if err != nil {
		return nil, err
	}
	webhook.Filter = filter

	return webhook, nil
}

// UpdateWebhook updates an existing webhook in the database
func (r *Repository) UpdateWebhook(ctx context.Context, webhook entities.Webhook) (*entities.Webhook, error) {
	// Execute webhook update and filter update in a single transaction
	err := r.db.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		updates := map[string]interface{}{
			"url":                  webhook.URL,
			"insecure_skip_verify": webhook.InsecureSkipVerify,
			"enabled":              webhook.Enabled,
			"timeout_seconds":      webhook.TimeoutSeconds,
		}

		result := tx.Model(&models.Webhook{}).Where("uuid = ?", webhook.UUID).Updates(updates)
		if result.Error != nil {
			return result.Error
		}

		if result.RowsAffected == 0 {
			return ErrNotFound
		}

		// Update filter if provided
		if webhook.Filter != nil {
			// Delete existing filter first
			if err := r.filterRepo.DeleteFiltersByIntegrationTx(ctx, tx, webhook.UUID, entities.EventFilterTypeWebhook); err != nil {
				return err
			}

			// Create new filter
			webhook.Filter.IntegrationID = webhook.UUID
			webhook.Filter.IntegrationType = entities.EventFilterTypeWebhook
			_, err := r.filterRepo.CreateEventFilterTx(ctx, tx, *webhook.Filter)
			if err != nil {
				return err
			}
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return r.GetWebhookByUUID(ctx, webhook.UUID)
}

// DeleteWebhook removes a webhook from the database by UUID
func (r *Repository) DeleteWebhook(ctx context.Context, id uuid.UUID) error {
	// Execute filter deletion and webhook deletion in a single transaction
	return r.db.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Delete associated filters first
		if err := r.filterRepo.DeleteFiltersByIntegrationTx(ctx, tx, id, entities.EventFilterTypeWebhook); err != nil {
			return err
		}

		result := tx.Where("uuid = ?", id).Delete(&models.Webhook{})
		if result.Error != nil {
			return result.Error
		}

		if result.RowsAffected == 0 {
			return ErrNotFound
		}

		return nil
	})
}

// toWebhook converts a models.Webhook to entities.Webhook
func toWebhook(model models.Webhook) *entities.Webhook {
	return &entities.Webhook{
		UUID:               model.UUID,
		URL:                model.URL,
		InsecureSkipVerify: model.InsecureSkipVerify,
		Enabled:            model.Enabled,
		TimeoutSeconds:     model.TimeoutSeconds,
		CreatedAt:          model.CreatedAt,
		UpdatedAt:          model.UpdatedAt,
	}
}
