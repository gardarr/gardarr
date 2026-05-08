package task_metadata

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"mime/multipart"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jfxdev/gardarr/internal/entities"
	"github.com/jfxdev/gardarr/internal/infra/database"
	"github.com/jfxdev/gardarr/internal/models"
	task_metadata_repo "github.com/jfxdev/gardarr/internal/repository/task_metadata"
)

const (
	MaxFileSize      = 10 << 20 // 10 MB
	AllowedMimeTypes = "image/jpeg,image/png,image/gif,image/webp"
)

// validateTaskHash ensures the provided taskHash contains only safe characters (no slashes, no traversal)
func validateTaskHash(taskHash string) error {
	// Only allow alphanumeric, `_`, and `-`
	var validTaskHash = regexp.MustCompile(`^[a-zA-Z0-9_-]+$`)
	if !validTaskHash.MatchString(taskHash) {
		return fmt.Errorf("invalid task_hash value")
	}
	return nil
}

// Service handles task metadata operations
type Service struct {
	repo      *task_metadata_repo.Repository
	db        *database.Database
	uploadDir string
	baseURL   string
}

// NewService creates a new task metadata service
func NewService(db *database.Database, baseURL, uploadDir string) (*Service, error) {
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		// Log error but continue
		return nil, fmt.Errorf("failed to create upload directory: %w", err)
	}

	return &Service{
		repo:      task_metadata_repo.NewRepository(db),
		db:        db,
		uploadDir: uploadDir,
		baseURL:   baseURL,
	}, nil
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
	// Validate taskHash to prevent path traversal
	if err := validateTaskHash(taskHash); err != nil {
		return nil, fmt.Errorf("invalid task_hash: %w", err)
	}

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
	filename := fmt.Sprintf("%s_%s%s", taskHash, time.Now().String(), ext)

	// Ensure filename contains no path separators (belt-and-suspenders)
	if strings.Contains(filename, "/") || strings.Contains(filename, "\\") || strings.Contains(filename, "..") {
		return nil, fmt.Errorf("invalid generated filename")
	}

	filePath := filepath.Join(s.uploadDir, filename)

	// Ensure filePath is within s.uploadDir
	absFilePath, err := filepath.Abs(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to resolve file path: %w", err)
	}
	absUploadDir, err := filepath.Abs(s.uploadDir)
	if err != nil {
		return nil, fmt.Errorf("failed to resolve upload directory: %w", err)
	}
	if !strings.HasPrefix(absFilePath, absUploadDir+string(os.PathSeparator)) && absFilePath != absUploadDir {
		return nil, fmt.Errorf("file path escapes upload directory")
	}

	// Create file
	dst, err := os.Create(absFilePath)
	if err != nil {
		return nil, fmt.Errorf("failed to create file: %w", err)
	}
	defer dst.Close()

	// Copy file contents
	if _, err := io.Copy(dst, file); err != nil {
		os.Remove(absFilePath)
		return nil, fmt.Errorf("failed to write file: %w", err)
	}

	// Check if metadata already exists
	existing, err := s.repo.GetByTaskHash(ctx, taskHash)
	if err != nil {
		os.Remove(absFilePath)
		return nil, err
	}

	if existing != nil {
		// Delete old image if exists (validate path to prevent path traversal)
		if existing.ImagePath != "" {
			if err := s.validateImagePath(existing.ImagePath); err != nil {
				slog.Warn("skipping image deletion due to path validation failure", "error", err)
			} else {
				os.Remove(existing.ImagePath)
			}
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
		os.Remove(absFilePath)
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

	// Delete file if exists (validate path to prevent path traversal)
	if metadata.ImagePath != "" {
		if err := s.validateImagePath(metadata.ImagePath); err == nil {
			os.Remove(metadata.ImagePath)
		}
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

	// Delete file if exists (validate path to prevent path traversal)
	if metadata.ImagePath != "" {
		if err := s.validateImagePath(metadata.ImagePath); err == nil {
			os.Remove(metadata.ImagePath)
		}
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

	// Validate path is within upload directory to prevent path traversal
	if err := s.validateImagePath(metadata.ImagePath); err != nil {
		return "", fmt.Errorf("invalid image path: %w", err)
	}

	return metadata.ImagePath, nil
}

// validateImagePath ensures the path is within the upload directory to prevent path traversal attacks
func (s *Service) validateImagePath(imagePath string) error {
	// Clean and resolve the absolute path
	absPath, err := filepath.Abs(imagePath)
	if err != nil {
		return fmt.Errorf("failed to resolve absolute path: %w", err)
	}

	// Clean and resolve the absolute upload directory
	absUploadDir, err := filepath.Abs(s.uploadDir)
	if err != nil {
		return fmt.Errorf("failed to resolve upload directory: %w", err)
	}

	// Ensure the path is within the upload directory
	relPath, err := filepath.Rel(absUploadDir, absPath)
	if err != nil {
		return fmt.Errorf("path validation failed: %w", err)
	}

	// Check for path traversal (if relPath starts with "..", it's outside the directory)
	if strings.HasPrefix(relPath, "..") {
		return fmt.Errorf("path traversal detected")
	}

	return nil
}

type uploadFileInfo struct {
	path string
	size int64
}

// scanUploadDir reads all files from the upload directory and returns a map keyed by full path.
func (s *Service) scanUploadDir() (map[string]uploadFileInfo, error) {
	entries, err := os.ReadDir(s.uploadDir)
	if err != nil {
		return nil, fmt.Errorf("failed to read upload directory: %w", err)
	}

	filesByPath := make(map[string]uploadFileInfo)
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		fullPath := filepath.Join(s.uploadDir, entry.Name())
		filesByPath[fullPath] = uploadFileInfo{path: fullPath, size: info.Size()}
	}
	return filesByPath, nil
}

// queryHashToWorkerID maps task hashes to their worker IDs via the task_states table.
func (s *Service) queryHashToWorkerID(ctx context.Context, taskHashes []string) (map[string]string, error) {
	hashToWorkerID := make(map[string]string)
	if len(taskHashes) == 0 {
		return hashToWorkerID, nil
	}
	var taskStates []struct {
		Hash     string    `gorm:"column:hash"`
		WorkerID uuid.UUID `gorm:"column:worker_id"`
	}
	if err := s.db.DB.WithContext(ctx).
		Table("task_states").
		Select("hash, worker_id").
		Where("hash IN ?", taskHashes).
		Find(&taskStates).Error; err != nil {
		return nil, fmt.Errorf("failed to query task_states: %w", err)
	}
	for _, ts := range taskStates {
		hashToWorkerID[ts.Hash] = ts.WorkerID.String()
	}
	return hashToWorkerID, nil
}

// queryWorkerNames returns a map of worker UUID strings to their display names.
func (s *Service) queryWorkerNames(ctx context.Context) map[string]string {
	workerNames := make(map[string]string)
	var workers []struct {
		UUID uuid.UUID `gorm:"column:uuid"`
		Name string    `gorm:"column:name"`
	}
	if err := s.db.DB.WithContext(ctx).
		Table("workers").
		Select("uuid, name").
		Find(&workers).Error; err != nil {
		slog.Warn("failed to query workers", "error", err)
		return workerNames
	}
	for _, w := range workers {
		workerNames[w.UUID.String()] = w.Name
	}
	return workerNames
}

// GetImageStorageStatsByWorker returns per-worker image storage stats using a filesystem-first approach
func (s *Service) GetImageStorageStatsByWorker(ctx context.Context) (*models.ImageStorageStatsResponse, error) {
	// 1. Scan uploadDir for all files
	filesByPath, err := s.scanUploadDir()
	if err != nil {
		return nil, err
	}

	// 2. Get all TaskMetadata with images → build map[imagePath]*TaskMetadata
	metadataList, err := s.repo.GetAllWithImages(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get metadata with images: %w", err)
	}
	metaByPath := make(map[string]*models.TaskMetadata, len(metadataList))
	for i := range metadataList {
		metaByPath[metadataList[i].ImagePath] = &metadataList[i]
	}

	// 3. Collect all task hashes that have files on disk
	var taskHashes []string
	for _, meta := range metadataList {
		if _, exists := filesByPath[meta.ImagePath]; exists {
			taskHashes = append(taskHashes, meta.TaskHash)
		}
	}

	// 4. Query TaskState to map task_hash → worker_id
	hashToWorkerID, err := s.queryHashToWorkerID(ctx, taskHashes)
	if err != nil {
		return nil, err
	}

	// 5. Get all known worker UUIDs and names
	workerNames := s.queryWorkerNames(ctx)

	// 6. Group files by worker
	type workerAccum struct {
		count int
		size  int64
	}
	workerStats := make(map[string]*workerAccum)
	var orphanCount int
	var orphanSize int64
	var totalSize int64
	var totalCount int

	for filePath, fi := range filesByPath {
		totalSize += fi.size
		totalCount++

		meta, hasMeta := metaByPath[filePath]
		if !hasMeta {
			// File on disk but no TaskMetadata → orphan
			orphanCount++
			orphanSize += fi.size
			continue
		}

		workerID, hasWorker := hashToWorkerID[meta.TaskHash]
		if !hasWorker {
			// TaskMetadata exists but no TaskState → orphan (task removed)
			orphanCount++
			orphanSize += fi.size
			continue
		}

		if _, ok := workerStats[workerID]; !ok {
			workerStats[workerID] = &workerAccum{}
		}
		workerStats[workerID].count++
		workerStats[workerID].size += fi.size
	}

	// 7. Build response
	var workerList []models.WorkerImageStats
	for workerID, stats := range workerStats {
		name, isActive := workerNames[workerID]
		workerList = append(workerList, models.WorkerImageStats{
			WorkerID:       workerID,
			WorkerName:     name,
			IsRemoved:      !isActive,
			ImageCount:     stats.count,
			TotalSizeBytes: stats.size,
		})
	}

	return &models.ImageStorageStatsResponse{
		Workers:         workerList,
		OrphanCount:     orphanCount,
		OrphanSizeBytes: orphanSize,
		TotalSizeBytes:  totalSize,
		TotalImageCount: totalCount,
	}, nil
}

// DeleteImagesByWorker deletes all images belonging to a specific worker
func (s *Service) DeleteImagesByWorker(ctx context.Context, workerID string) (int, error) {
	// 1. Get all task hashes belonging to this worker from TaskState
	var taskHashes []string
	if err := s.db.DB.WithContext(ctx).
		Table("task_states").
		Select("hash").
		Where("worker_id = ?", workerID).
		Pluck("hash", &taskHashes).Error; err != nil {
		return 0, fmt.Errorf("failed to query task_states: %w", err)
	}

	if len(taskHashes) == 0 {
		return 0, nil
	}

	// 2. Get TaskMetadata for those hashes that have images
	metadataMap, err := s.repo.GetByTaskHashes(ctx, taskHashes)
	if err != nil {
		return 0, fmt.Errorf("failed to get metadata: %w", err)
	}

	// 3. Delete files from disk
	var deletedCount int
	var hashesWithImages []string
	for hash, meta := range metadataMap {
		if meta.ImagePath == "" {
			continue
		}
		if err := s.validateImagePath(meta.ImagePath); err != nil {
			slog.Warn("skipping image deletion due to path validation failure", "error", err, "path", meta.ImagePath)
			continue
		}
		if err := os.Remove(meta.ImagePath); err != nil && !os.IsNotExist(err) {
			slog.Warn("failed to delete image file", "error", err, "path", meta.ImagePath)
			continue
		}
		hashesWithImages = append(hashesWithImages, hash)
		deletedCount++
	}

	// 4. Clear image paths in DB
	if len(hashesWithImages) > 0 {
		if _, err := s.repo.ClearImagePathsByTaskHashes(ctx, hashesWithImages); err != nil {
			slog.Error("failed to clear image paths in DB", "error", err)
			return deletedCount, fmt.Errorf("files deleted but failed to clear DB: %w", err)
		}
	}

	return deletedCount, nil
}

// queryHashesWithState returns the set of task hashes (from the provided list) that have a row in task_states.
func (s *Service) queryHashesWithState(ctx context.Context, taskHashes []string) (map[string]bool, error) {
	hashHasState := make(map[string]bool)
	if len(taskHashes) == 0 {
		return hashHasState, nil
	}
	var taskStates []struct {
		Hash string `gorm:"column:hash"`
	}
	if err := s.db.DB.WithContext(ctx).
		Table("task_states").
		Select("hash").
		Where("hash IN ?", taskHashes).
		Find(&taskStates).Error; err != nil {
		return nil, fmt.Errorf("failed to query task_states: %w", err)
	}
	for _, ts := range taskStates {
		hashHasState[ts.Hash] = true
	}
	return hashHasState, nil
}

// removeValidatedFile validates the path is within the upload dir, then removes it.
// Returns true if the file was successfully removed.
func (s *Service) removeValidatedFile(filePath string) bool {
	if err := s.validateImagePath(filePath); err != nil {
		slog.Warn("skipping orphan deletion due to path validation failure", "error", err)
		return false
	}
	if err := os.Remove(filePath); err != nil && !os.IsNotExist(err) {
		slog.Warn("failed to delete orphan file", "error", err, "path", filePath)
		return false
	}
	return true
}

// clearImagePaths clears image_path in DB for the given task hashes, if any.
func (s *Service) clearImagePaths(ctx context.Context, hashes []string) {
	if len(hashes) == 0 {
		return
	}
	if _, err := s.repo.ClearImagePathsByTaskHashes(ctx, hashes); err != nil {
		slog.Error("failed to clear image paths for orphans in DB", "error", err)
	}
}

// DeleteOrphanImages deletes orphan files from uploadDir.
// An orphan is either: (a) a file not referenced by any TaskMetadata, or
// (b) a file referenced by TaskMetadata but whose task_hash has no TaskState.
// This method mirrors the exact same filesystem-first classification used by GetImageStorageStatsByWorker.
func (s *Service) DeleteOrphanImages(ctx context.Context) (int, error) {
	// 1. Scan uploadDir for all files (filesystem-first, matching stats logic)
	filesByPath, err := s.scanUploadDir()
	if err != nil {
		return 0, err
	}

	// 2. Get all TaskMetadata with images → build map[imagePath]*TaskMetadata
	metadataList, err := s.repo.GetAllWithImages(ctx)
	if err != nil {
		return 0, fmt.Errorf("failed to get metadata with images: %w", err)
	}
	metaByPath := make(map[string]*models.TaskMetadata, len(metadataList))
	for i := range metadataList {
		metaByPath[metadataList[i].ImagePath] = &metadataList[i]
	}

	// 3. Collect only task hashes that have files on disk (matching stats logic)
	var taskHashes []string
	for _, meta := range metadataList {
		if _, exists := filesByPath[meta.ImagePath]; exists {
			taskHashes = append(taskHashes, meta.TaskHash)
		}
	}

	// 4. Query TaskState to find which hashes still have an worker link
	hashHasState, err := s.queryHashesWithState(ctx, taskHashes)
	if err != nil {
		return 0, err
	}

	// 5. Walk files and delete orphans (same classification as stats)
	var deletedCount int
	var hashesToClear []string
	for filePath := range filesByPath {
		meta, hasMeta := metaByPath[filePath]

		// Case A: file on disk, no TaskMetadata → pure FS orphan
		// Case B: file on disk, has TaskMetadata, but no TaskState → stale orphan
		isOrphan := !hasMeta || !hashHasState[meta.TaskHash]
		if !isOrphan {
			continue
		}

		if !s.removeValidatedFile(filePath) {
			continue
		}
		deletedCount++

		// If it had a TaskMetadata record, clear image_path in DB
		if hasMeta {
			hashesToClear = append(hashesToClear, meta.TaskHash)
		}
	}

	// 6. Clear image paths in DB for stale orphans
	s.clearImagePaths(ctx, hashesToClear)

	return deletedCount, nil
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
