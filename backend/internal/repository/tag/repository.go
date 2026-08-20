package tag

import (
	"context"
	"errors"
	"strings"

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

// CreateTag inserts a new tag into the database.
func (r *Repository) CreateTag(ctx context.Context, tag entities.Tag) (*entities.Tag, error) {
	model := &models.Tag{
		ID:    tag.ID,
		Name:  tag.Name,
		Kind:  models.TagKind(tag.Kind),
		Color: tag.Color,
		Icon:  tag.Icon,
	}

	if err := r.db.DB.WithContext(ctx).Create(model).Error; err != nil {
		if errors.Is(err, gorm.ErrDuplicatedKey) || strings.Contains(err.Error(), "UNIQUE constraint failed") {
			return nil, errors.New("tag already exists")
		}

		return nil, err
	}

	return toTag(*model), nil
}

// ListTags retrieves every locally-stored tag.
func (r *Repository) ListTags(ctx context.Context) ([]*entities.Tag, error) {
	var rows []models.Tag
	if err := r.db.DB.WithContext(ctx).Find(&rows).Error; err != nil {
		return nil, err
	}

	result := make([]*entities.Tag, len(rows))
	for i, item := range rows {
		result[i] = toTag(item)
	}

	return result, nil
}

// GetTagByID retrieves a single tag by its ID.
func (r *Repository) GetTagByID(ctx context.Context, id string) (*entities.Tag, error) {
	var model models.Tag
	if err := r.db.DB.WithContext(ctx).Where("id = ?", id).First(&model).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("tag not found")
		}
		return nil, err
	}

	return toTag(model), nil
}

// GetTagByName retrieves a single tag by its kind and name.
func (r *Repository) GetTagByName(ctx context.Context, kind entities.TagKind, name string) (*entities.Tag, error) {
	var model models.Tag
	if err := r.db.DB.WithContext(ctx).Where("kind = ? AND name = ?", string(kind), name).First(&model).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("tag not found")
		}
		return nil, err
	}

	return toTag(model), nil
}

// UpdateTag updates an existing tag's color/icon.
// Note: Name, Kind and ID are immutable and will not be updated.
func (r *Repository) UpdateTag(ctx context.Context, tag entities.Tag) (*entities.Tag, error) {
	updates := map[string]interface{}{
		"color": tag.Color,
		"icon":  tag.Icon,
	}

	if err := r.db.DB.WithContext(ctx).Model(&models.Tag{}).Where("id = ?", tag.ID).Updates(updates).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("tag not found")
		}
		return nil, err
	}

	return r.GetTagByID(ctx, tag.ID)
}

// DeleteTag removes a tag from the database by ID.
func (r *Repository) DeleteTag(ctx context.Context, id string) error {
	result := r.db.DB.WithContext(ctx).Where("id = ?", id).Delete(&models.Tag{})
	if result.Error != nil {
		return result.Error
	}

	if result.RowsAffected == 0 {
		return errors.New("tag not found")
	}

	return nil
}

// toTag converts a models.Tag to entities.Tag.
func toTag(model models.Tag) *entities.Tag {
	return &entities.Tag{
		ID:        model.ID,
		Name:      model.Name,
		Kind:      entities.TagKind(model.Kind),
		Color:     model.Color,
		Icon:      model.Icon,
		CreatedAt: model.CreatedAt,
		UpdatedAt: model.UpdatedAt,
	}
}
