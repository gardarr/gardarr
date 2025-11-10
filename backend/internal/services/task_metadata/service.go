package task_metadata

import (
	"context"
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gardarr/gardarr/internal/entities"
	"github.com/gardarr/gardarr/internal/infra/database"
	"github.com/gardarr/gardarr/internal/models"
	task_metadata_repo "github.com/gardarr/gardarr/internal/repository/task_metadata"
	"github.com/google/uuid"
)

const (
	MaxFileSize      = 10 << 20 // 10 MB
	UploadDir        = "uploads/task_images"
	AllowedMimeTypes = "image/jpeg,image/png,image/gif,image/webp"
)

// Service handles task metadata operations
type Service struct {
	repo      *task_metadata_repo.Repository
	uploadDir string
	baseURL   string
}

// NewService creates a new task metadata service
func NewService(db *database.Database, baseURL string) *Service {
	// Create upload directory if it doesn't exist
	uploadDir := UploadDir
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		// Log error but continue
		fmt.Printf("Warning: failed to create upload directory: %v\n", err)
	}

	return &Service{
		repo:      task_metadata_repo.NewRepository(db),
		uploadDir: uploadDir,
		baseURL:   baseURL,
	}
}

// GetByTaskHash retrieves metadata for a task
func (s *Service) GetByTaskHash(ctx context.Context, taskHash string) (*entities.TaskMetadata, error) {
	model, err := s.repo.GetByTaskHash(ctx, taskHash)
	if err != nil {
		return nil, err
	}
	if model == nil {
		return nil, nil
	}

	return s.modelToEntity(model), nil
}

// GetByTaskHashes retrieves metadata for multiple tasks (batch)
func (s *Service) GetByTaskHashes(ctx context.Context, taskHashes []string) (map[string]*entities.TaskMetadata, error) {
	modelsMap, err := s.repo.GetByTaskHashes(ctx, taskHashes)
	if err != nil {
		return nil, err
	}

	result := make(map[string]*entities.TaskMetadata, len(modelsMap))
	for hash, model := range modelsMap {
		result[hash] = s.modelToEntity(model)
	}
	return result, nil
}

// UploadImage uploads an image for a task
func (s *Service) UploadImage(ctx context.Context, taskHash string, file multipart.File, header *multipart.FileHeader) (*entities.TaskMetadata, error) {
	// Validate file size
	if header.Size > MaxFileSize {
		return nil, fmt.Errorf("file size exceeds maximum allowed size of %d bytes", MaxFileSize)
	}

	// Validate MIME type
	contentType := header.Header.Get("Content-Type")
	if !s.isAllowedMimeType(contentType) {
		return nil, fmt.Errorf("invalid file type: %s. Allowed types: %s", contentType, AllowedMimeTypes)
	}

	// Generate unique filename
	ext := filepath.Ext(header.Filename)
	filename := fmt.Sprintf("%s_%d%s", taskHash, time.Now().Unix(), ext)
	filePath := filepath.Join(s.uploadDir, filename)

	// Create file
	dst, err := os.Create(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to create file: %w", err)
	}
	defer dst.Close()

	// Copy file contents
	if _, err := io.Copy(dst, file); err != nil {
		os.Remove(filePath)
		return nil, fmt.Errorf("failed to write file: %w", err)
	}

	// Check if metadata already exists
	existing, err := s.repo.GetByTaskHash(ctx, taskHash)
	if err != nil {
		os.Remove(filePath)
		return nil, err
	}

	if existing != nil {
		// Delete old image if exists
		if existing.ImagePath != "" {
			os.Remove(existing.ImagePath)
		}

		// Update existing metadata
		existing.ImagePath = filePath
		existing.UpdatedAt = time.Now()
		if err := s.repo.Update(ctx, existing); err != nil {
			os.Remove(filePath)
			return nil, err
		}
		return s.modelToEntity(existing), nil
	}

	// Create new metadata
	metadata := &models.TaskMetadata{
		UUID:      uuid.New(),
		TaskHash:  taskHash,
		ImagePath: filePath,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if err := s.repo.Create(ctx, metadata); err != nil {
		os.Remove(filePath)
		return nil, err
	}

	return s.modelToEntity(metadata), nil
}

// UpdateDescription updates the description of task metadata
func (s *Service) UpdateDescription(ctx context.Context, taskHash string, description string) (*entities.TaskMetadata, error) {
	existing, err := s.repo.GetByTaskHash(ctx, taskHash)
	if err != nil {
		return nil, err
	}

	if existing != nil {
		// Update existing metadata
		existing.Description = description
		existing.UpdatedAt = time.Now()
		if err := s.repo.Update(ctx, existing); err != nil {
			return nil, err
		}
		return s.modelToEntity(existing), nil
	}

	// Create new metadata with description only
	metadata := &models.TaskMetadata{
		UUID:        uuid.New(),
		TaskHash:    taskHash,
		Description: description,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := s.repo.Create(ctx, metadata); err != nil {
		return nil, err
	}

	return s.modelToEntity(metadata), nil
}

// UpdateImagePosition updates the vertical position of the image
func (s *Service) UpdateImagePosition(ctx context.Context, taskHash string, positionY float64) (*entities.TaskMetadata, error) {
	existing, err := s.repo.GetByTaskHash(ctx, taskHash)
	if err != nil {
		return nil, err
	}

	if existing == nil {
		return nil, fmt.Errorf("metadata not found")
	}

	// Update position
	existing.ImagePositionY = positionY
	existing.UpdatedAt = time.Now()
	if err := s.repo.Update(ctx, existing); err != nil {
		return nil, err
	}

	return s.modelToEntity(existing), nil
}

// UpdateImageOpacity updates the opacity of the image
func (s *Service) UpdateImageOpacity(ctx context.Context, taskHash string, opacity float64) (*entities.TaskMetadata, error) {
	existing, err := s.repo.GetByTaskHash(ctx, taskHash)
	if err != nil {
		return nil, err
	}

	if existing == nil {
		return nil, fmt.Errorf("metadata not found")
	}

	// Validate opacity range (15-85%)
	if opacity < 15 || opacity > 85 {
		return nil, fmt.Errorf("opacity must be between 15 and 85")
	}

	// Update opacity
	existing.ImageOpacity = opacity
	existing.UpdatedAt = time.Now()
	if err := s.repo.Update(ctx, existing); err != nil {
		return nil, err
	}

	return s.modelToEntity(existing), nil
}

// DeleteImage deletes the image from task metadata
func (s *Service) DeleteImage(ctx context.Context, taskHash string) error {
	metadata, err := s.repo.GetByTaskHash(ctx, taskHash)
	if err != nil {
		return err
	}
	if metadata == nil {
		return fmt.Errorf("metadata not found")
	}

	// Delete file if exists
	if metadata.ImagePath != "" {
		os.Remove(metadata.ImagePath)
	}

	// If no description, delete entire metadata, otherwise just clear image path
	if metadata.Description == "" {
		return s.repo.DeleteByTaskHash(ctx, taskHash)
	}

	metadata.ImagePath = ""
	metadata.UpdatedAt = time.Now()
	return s.repo.Update(ctx, metadata)
}

// Delete deletes task metadata completely
func (s *Service) Delete(ctx context.Context, taskHash string) error {
	metadata, err := s.repo.GetByTaskHash(ctx, taskHash)
	if err != nil {
		return err
	}
	if metadata == nil {
		return nil
	}

	// Delete file if exists
	if metadata.ImagePath != "" {
		os.Remove(metadata.ImagePath)
	}

	return s.repo.DeleteByTaskHash(ctx, taskHash)
}

// GetImagePath returns the filesystem path for an image
func (s *Service) GetImagePath(ctx context.Context, taskHash string) (string, error) {
	metadata, err := s.repo.GetByTaskHash(ctx, taskHash)
	if err != nil {
		return "", err
	}
	if metadata == nil || metadata.ImagePath == "" {
		return "", fmt.Errorf("image not found")
	}

	return metadata.ImagePath, nil
}

// Helper functions

func (s *Service) isAllowedMimeType(contentType string) bool {
	allowedTypes := strings.Split(AllowedMimeTypes, ",")
	for _, allowed := range allowedTypes {
		if strings.TrimSpace(allowed) == contentType {
			return true
		}
	}
	return false
}

func (s *Service) modelToEntity(model *models.TaskMetadata) *entities.TaskMetadata {
	entity := &entities.TaskMetadata{
		UUID:           model.UUID,
		TaskHash:       model.TaskHash,
		ImagePath:      model.ImagePath,
		Description:    model.Description,
		ImagePositionY: model.ImagePositionY,
		ImageOpacity:   model.ImageOpacity,
		CreatedAt:      model.CreatedAt,
		UpdatedAt:      model.UpdatedAt,
	}

	// Generate URLs if image exists
	if model.ImagePath != "" {
		filename := filepath.Base(model.ImagePath)
		entity.ImageURL = fmt.Sprintf("%s/media/%s", s.baseURL, filename)
		entity.ThumbnailURL = fmt.Sprintf("%s/media/%s", s.baseURL, filename)
	}

	return entity
}
