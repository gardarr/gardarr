package task_metadata

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jfxdev/gardarr/internal/infra/database"
	"github.com/jfxdev/gardarr/internal/models"
	"gorm.io/gorm"
)

// Repository handles task metadata database operations
type Repository struct {
	db *database.Database
}

// NewRepository creates a new task metadata repository
func NewRepository(db *database.Database) *Repository {
	return &Repository{db: db}
}

// GetByTaskHash retrieves task metadata by task hash
func (r *Repository) GetByTaskHash(ctx context.Context, taskHash string) (*models.TaskMetadata, error) {
	var metadata models.TaskMetadata
	err := r.db.DB.WithContext(ctx).Where("task_hash = ?", taskHash).First(&metadata).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &metadata, nil
}

// GetByUUID retrieves task metadata by UUID
func (r *Repository) GetByUUID(ctx context.Context, uuid uuid.UUID) (*models.TaskMetadata, error) {
	var metadata models.TaskMetadata
	err := r.db.DB.WithContext(ctx).Where("uuid = ?", uuid).First(&metadata).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &metadata, nil
}

// GetByTaskHashes retrieves multiple task metadata by task hashes (batch)
func (r *Repository) GetByTaskHashes(ctx context.Context, taskHashes []string) (map[string]*models.TaskMetadata, error) {
	var metadataList []models.TaskMetadata
	err := r.db.DB.WithContext(ctx).Where("task_hash IN ?", taskHashes).Find(&metadataList).Error
	if err != nil {
		return nil, err
	}

	// Map by task hash for quick lookup
	result := make(map[string]*models.TaskMetadata, len(metadataList))
	for i := range metadataList {
		result[metadataList[i].TaskHash] = &metadataList[i]
	}
	return result, nil
}

// Create creates a new task metadata entry
func (r *Repository) Create(ctx context.Context, metadata *models.TaskMetadata) error {
	return r.db.DB.WithContext(ctx).Create(metadata).Error
}

// Update updates an existing task metadata entry
func (r *Repository) Update(ctx context.Context, metadata *models.TaskMetadata) error {
	return r.db.DB.WithContext(ctx).Save(metadata).Error
}

// Delete deletes task metadata by UUID
func (r *Repository) Delete(ctx context.Context, uuid uuid.UUID) error {
	return r.db.DB.WithContext(ctx).Where("uuid = ?", uuid).Delete(&models.TaskMetadata{}).Error
}

// DeleteByTaskHash deletes task metadata by task hash
func (r *Repository) DeleteByTaskHash(ctx context.Context, taskHash string) error {
	return r.db.DB.WithContext(ctx).Where("task_hash = ?", taskHash).Delete(&models.TaskMetadata{}).Error
}
