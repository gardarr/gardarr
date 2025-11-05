package settings

import (
	"context"
	"errors"

	"github.com/gardarr/gardarr/internal/entities"
	"github.com/gardarr/gardarr/internal/infra/database"
	"github.com/gardarr/gardarr/internal/models"
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

// GetSettings retrieves the system settings
func (r *Repository) GetSettings(ctx context.Context) (*entities.Settings, error) {
	var model models.Settings
	if err := r.db.DB.WithContext(ctx).Where("id = ?", "system").First(&model).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("settings not found")
		}
		return nil, err
	}

	return toSettings(model), nil
}

// CreateSettings creates a new system settings record
func (r *Repository) CreateSettings(ctx context.Context, timezone, theme, language string) (*entities.Settings, error) {
	model := models.Settings{
		ID:              "system",
		Timezone:        timezone,
		DefaultTheme:    theme,
		DefaultLanguage: language,
	}
	if err := r.db.DB.WithContext(ctx).Create(&model).Error; err != nil {
		return nil, err
	}
	return toSettings(model), nil
}

// UpdateTimezone updates the system timezone
func (r *Repository) UpdateTimezone(ctx context.Context, timezone string) error {
	// Try to update existing settings
	result := r.db.DB.WithContext(ctx).Model(&models.Settings{}).
		Where("id = ?", "system").
		Update("timezone", timezone)

	if result.Error != nil {
		return result.Error
	}

	if result.RowsAffected == 0 {
		return errors.New("settings not found")
	}

	return nil
}

// UpdateTheme updates the system default theme
func (r *Repository) UpdateTheme(ctx context.Context, theme string) error {
	result := r.db.DB.WithContext(ctx).Model(&models.Settings{}).
		Where("id = ?", "system").
		Update("default_theme", theme)

	if result.Error != nil {
		return result.Error
	}

	if result.RowsAffected == 0 {
		return errors.New("settings not found")
	}

	return nil
}

// UpdateLanguage updates the system default language
func (r *Repository) UpdateLanguage(ctx context.Context, language string) error {
	result := r.db.DB.WithContext(ctx).Model(&models.Settings{}).
		Where("id = ?", "system").
		Update("default_language", language)

	if result.Error != nil {
		return result.Error
	}

	if result.RowsAffected == 0 {
		return errors.New("settings not found")
	}

	return nil
}

// toSettings converts a models.Settings to entities.Settings
func toSettings(model models.Settings) *entities.Settings {
	return &entities.Settings{
		ID:              model.ID,
		Timezone:        model.Timezone,
		DefaultTheme:    model.DefaultTheme,
		DefaultLanguage: model.DefaultLanguage,
		CreatedAt:       model.CreatedAt,
		UpdatedAt:       model.UpdatedAt,
	}
}
