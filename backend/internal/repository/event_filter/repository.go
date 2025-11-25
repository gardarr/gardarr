package event_filter

import (
	"context"
	"encoding/json"
	"errors"

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

var (
	errEventFilterNotFound = errors.New("event filter not found")
)

// CreateEventFilter inserts a new event filter into the database
func (r *Repository) CreateEventFilter(ctx context.Context, filter entities.EventFilter) (*entities.EventFilter, error) {
	return r.CreateEventFilterTx(ctx, r.db.DB, filter)
}

// CreateEventFilterTx inserts a new event filter using the provided DB connection (supports transactions)
func (r *Repository) CreateEventFilterTx(ctx context.Context, db *gorm.DB, filter entities.EventFilter) (*entities.EventFilter, error) {
	model, err := toModel(filter)
	if err != nil {
		return nil, err
	}

	// Use Select to ensure all fields are inserted, including empty strings
	if err := db.WithContext(ctx).Select("*").Create(model).Error; err != nil {
		return nil, err
	}

	return toEntity(*model)
}

// GetFilterByUUID retrieves a single event filter by its UUID
func (r *Repository) GetFilterByUUID(ctx context.Context, id uuid.UUID) (*entities.EventFilter, error) {
	var model models.EventFilter
	if err := r.db.DB.WithContext(ctx).Where("uuid = ?", id).First(&model).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errEventFilterNotFound
		}
		return nil, err
	}

	return toEntity(model)
}

// GetFilterByIntegration retrieves the filter for a specific integration (1:1 relationship)
// Returns nil, nil if no filter exists for the integration
func (r *Repository) GetFilterByIntegration(ctx context.Context, integrationID uuid.UUID, integrationType entities.EventFilterType) (*entities.EventFilter, error) {
	var model models.EventFilter
	result := r.db.DB.WithContext(ctx).
		Where("integration_id = ? AND integration_type = ?", integrationID, string(integrationType)).
		First(&model)

	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, result.Error
	}

	return toEntity(model)
}

// UpdateEventFilter updates an existing event filter in the database
func (r *Repository) UpdateEventFilter(ctx context.Context, filter entities.EventFilter) (*entities.EventFilter, error) {
	model, err := toModel(filter)
	if err != nil {
		return nil, err
	}

	updates := map[string]interface{}{
		"event_type_filter": model.EventTypeFilter,
		"status_filter":     model.StatusFilter,
		"category_filter":   model.CategoryFilter,
		"name_terms":        model.NameTerms,
	}

	if err := r.db.DB.WithContext(ctx).Model(&models.EventFilter{}).Where("uuid = ?", filter.UUID).Updates(updates).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errEventFilterNotFound
		}
		return nil, err
	}

	return r.GetFilterByUUID(ctx, filter.UUID)
}

// DeleteEventFilter removes an event filter from the database by UUID
func (r *Repository) DeleteEventFilter(ctx context.Context, id uuid.UUID) error {
	result := r.db.DB.WithContext(ctx).Where("uuid = ?", id).Delete(&models.EventFilter{})
	if result.Error != nil {
		return result.Error
	}

	if result.RowsAffected == 0 {
		return errEventFilterNotFound
	}

	return nil
}

// DeleteFiltersByIntegration removes all filters associated with an integration
func (r *Repository) DeleteFiltersByIntegration(ctx context.Context, integrationID uuid.UUID, integrationType entities.EventFilterType) error {
	return r.DeleteFiltersByIntegrationTx(ctx, r.db.DB, integrationID, integrationType)
}

// DeleteFiltersByIntegrationTx removes all filters associated with an integration using the provided DB connection (supports transactions)
func (r *Repository) DeleteFiltersByIntegrationTx(ctx context.Context, db *gorm.DB, integrationID uuid.UUID, integrationType entities.EventFilterType) error {
	return db.WithContext(ctx).
		Where("integration_id = ? AND integration_type = ?", integrationID, string(integrationType)).
		Delete(&models.EventFilter{}).Error
}

// toModel converts entities.EventFilter to models.EventFilter
func toModel(entity entities.EventFilter) (*models.EventFilter, error) {
	model := &models.EventFilter{
		UUID:            entity.UUID,
		IntegrationID:   entity.IntegrationID,
		IntegrationType: string(entity.IntegrationType),
		EventTypeFilter: entity.EventTypeFilter,
		CreatedAt:       entity.CreatedAt,
		UpdatedAt:       entity.UpdatedAt,
	}

	// Marshal JSON fields
	if len(entity.StatusFilter) > 0 {
		data, err := json.Marshal(entity.StatusFilter)
		if err != nil {
			return nil, err
		}
		model.StatusFilter = string(data)
	}

	if len(entity.CategoryFilter) > 0 {
		data, err := json.Marshal(entity.CategoryFilter)
		if err != nil {
			return nil, err
		}
		model.CategoryFilter = string(data)
	}

	if len(entity.NameTerms) > 0 {
		data, err := json.Marshal(entity.NameTerms)
		if err != nil {
			return nil, err
		}
		model.NameTerms = string(data)
	}

	return model, nil
}

// toEntity converts models.EventFilter to entities.EventFilter
func toEntity(model models.EventFilter) (*entities.EventFilter, error) {
	entity := &entities.EventFilter{
		UUID:            model.UUID,
		IntegrationID:   model.IntegrationID,
		IntegrationType: entities.EventFilterType(model.IntegrationType),
		EventTypeFilter: model.EventTypeFilter,
		StatusFilter:    []string{},
		CategoryFilter:  []string{},
		NameTerms:       []string{},
		CreatedAt:       model.CreatedAt,
		UpdatedAt:       model.UpdatedAt,
	}

	// Unmarshal JSON fields
	if model.StatusFilter != "" {
		if err := json.Unmarshal([]byte(model.StatusFilter), &entity.StatusFilter); err != nil {
			return nil, err
		}
	}

	if model.CategoryFilter != "" {
		if err := json.Unmarshal([]byte(model.CategoryFilter), &entity.CategoryFilter); err != nil {
			return nil, err
		}
	}

	if model.NameTerms != "" {
		if err := json.Unmarshal([]byte(model.NameTerms), &entity.NameTerms); err != nil {
			return nil, err
		}
	}

	return entity, nil
}
