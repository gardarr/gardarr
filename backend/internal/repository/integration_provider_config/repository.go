package integration_provider_config

import (
	"context"
	"errors"

	"github.com/jfxdev/gardarr/internal/entities"
	"github.com/jfxdev/gardarr/internal/infra/database"
	"github.com/jfxdev/gardarr/internal/models"
	"gorm.io/gorm"
)

var ErrNotFound = errors.New("integration provider config not found")

type Repository struct {
	db *database.Database
}

func NewRepository(db *database.Database) *Repository {
	return &Repository{db: db}
}

func (r *Repository) GetByProvider(ctx context.Context, provider string) (*entities.IntegrationProviderConfig, error) {
	var model models.IntegrationProviderConfig
	if err := r.db.DB.WithContext(ctx).Where("provider = ?", provider).First(&model).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	return toEntity(model), nil
}

func (r *Repository) Upsert(ctx context.Context, cfg entities.IntegrationProviderConfig) (*entities.IntegrationProviderConfig, error) {
	model := models.IntegrationProviderConfig{
		Provider:        cfg.Provider,
		Enabled:         cfg.Enabled,
		EncryptedAPIKey: cfg.EncryptedAPIKey,
	}

	if err := r.db.DB.WithContext(ctx).Save(&model).Error; err != nil {
		return nil, err
	}

	return r.GetByProvider(ctx, cfg.Provider)
}

func toEntity(model models.IntegrationProviderConfig) *entities.IntegrationProviderConfig {
	return &entities.IntegrationProviderConfig{
		Provider:        model.Provider,
		Enabled:         model.Enabled,
		EncryptedAPIKey: model.EncryptedAPIKey,
		CreatedAt:       model.CreatedAt,
		UpdatedAt:       model.UpdatedAt,
	}
}
