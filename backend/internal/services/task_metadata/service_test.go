package task_metadata

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jfxdev/gardarr/internal/infra/database"
	"github.com/jfxdev/gardarr/internal/models"
	"gorm.io/gorm"
)

const unexpectedErrFmt = "unexpected error: %v"

// setupTestService creates a Service with an in-memory DB and a temp uploadDir.
// It auto-migrates TaskMetadata, TaskState, and Worker tables.
func setupTestService(t *testing.T) (*Service, string) {
	t.Helper()
	db := database.SetupTestDB(t, &models.TaskMetadata{}, &models.TaskState{}, &models.Worker{})

	uploadDir := t.TempDir()

	svc, err := NewService(db, "http://localhost:3200", uploadDir, nil)
	if err != nil {
		t.Fatalf("NewService failed: %v", err)
	}
	return svc, uploadDir
}

func createTestMetadata(t *testing.T, svc *Service, metadata *models.TaskMetadata) {
	t.Helper()

	if metadata.UUID == uuid.Nil {
		metadata.UUID = uuid.New()
	}
	if metadata.CreatedAt.IsZero() {
		metadata.CreatedAt = time.Now()
	}
	if metadata.UpdatedAt.IsZero() {
		metadata.UpdatedAt = time.Now()
	}

	if err := svc.repo.Create(context.Background(), metadata); err != nil {
		t.Fatalf("create task_metadata failed: %v", err)
	}
}

// createTestFile creates a file with the given content in dir and returns its full path.
func createTestFile(t *testing.T, dir, name, content string) string {
	t.Helper()
	p := filepath.Join(dir, name)
	if err := os.WriteFile(p, []byte(content), 0644); err != nil {
		t.Fatalf("failed to create test file %s: %v", p, err)
	}
	return p
}

// seedWorker inserts a worker into the DB and returns its UUID string.
func seedWorker(t *testing.T, svc *Service, name string) string {
	t.Helper()
	workerUUID := uuid.New()
	worker := &models.Worker{
		UUID:                         workerUUID,
		Name:                         name,
		Type:                         "qbt",
		Address:                      "http://test",
		EncryptedQBittorrentURL:      "tok",
		EncryptedQBittorrentUsername: "",
		EncryptedQBittorrentPassword: "",
		Icon:                         "",
		Color:                        "",
		CreatedAt:                    time.Now(),
		UpdatedAt:                    time.Now(),
	}
	if err := svc.db.DB.Create(worker).Error; err != nil {
		t.Fatalf("seed worker failed: %v", err)
	}
	return workerUUID.String()
}

// seedTaskState inserts a task_state row linking a hash to a worker.
func seedTaskState(t *testing.T, svc *Service, workerID, hash string) {
	t.Helper()
	if err := svc.db.DB.Exec(
		"INSERT INTO task_states (worker_id, hash, state, progress, updated_at) VALUES (?, ?, 'seeding', 100, ?)",
		workerID, hash, time.Now(),
	).Error; err != nil {
		t.Fatalf("seed task_state failed: %v", err)
	}
}

// seedTaskMetadata inserts a task_metadata row.
func seedTaskMetadata(t *testing.T, svc *Service, taskHash, imagePath string) {
	t.Helper()
	ctx := context.Background()
	meta := &models.TaskMetadata{
		UUID:      uuid.New(),
		TaskHash:  taskHash,
		ImagePath: imagePath,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	if err := svc.repo.Create(ctx, meta); err != nil {
		t.Fatalf("seed task_metadata failed: %v", err)
	}
}

// ---------------------------------------------------------------------------
// Tests for GetImageStorageStatsByWorker
// ---------------------------------------------------------------------------

func TestGetImageStorageStatsByWorkerEmpty(t *testing.T) {
	svc, _ := setupTestService(t)
	ctx := context.Background()

	stats, err := svc.GetImageStorageStatsByWorker(ctx)
	if err != nil {
		t.Fatalf(unexpectedErrFmt, err)
	}
	if stats.TotalImageCount != 0 {
		t.Errorf("expected 0 total images, got %d", stats.TotalImageCount)
	}
	if stats.TotalSizeBytes != 0 {
		t.Errorf("expected 0 total size, got %d", stats.TotalSizeBytes)
	}
	if stats.OrphanCount != 0 {
		t.Errorf("expected 0 orphans, got %d", stats.OrphanCount)
	}
}

func TestGetImageStorageStatsByWorkerPerWorker(t *testing.T) {
	svc, uploadDir := setupTestService(t)
	ctx := context.Background()

	// Setup: 2 workers, each with 1 image file
	worker1 := seedWorker(t, svc, "Worker-1")
	worker2 := seedWorker(t, svc, "Worker-2")

	file1 := createTestFile(t, uploadDir, "hash1_img.jpg", "aaaa")   // 4 bytes
	file2 := createTestFile(t, uploadDir, "hash2_img.jpg", "bbbbbb") // 6 bytes

	seedTaskMetadata(t, svc, "hash1", file1)
	seedTaskMetadata(t, svc, "hash2", file2)
	seedTaskState(t, svc, worker1, "hash1")
	seedTaskState(t, svc, worker2, "hash2")

	stats, err := svc.GetImageStorageStatsByWorker(ctx)
	if err != nil {
		t.Fatalf(unexpectedErrFmt, err)
	}

	if stats.TotalImageCount != 2 {
		t.Errorf("expected 2 total images, got %d", stats.TotalImageCount)
	}
	if stats.TotalSizeBytes != 10 {
		t.Errorf("expected 10 total bytes, got %d", stats.TotalSizeBytes)
	}
	if stats.OrphanCount != 0 {
		t.Errorf("expected 0 orphans, got %d", stats.OrphanCount)
	}
	if len(stats.Workers) != 2 {
		t.Fatalf("expected 2 workers, got %d", len(stats.Workers))
	}

	// Check workers are active (not removed)
	for _, w := range stats.Workers {
		if w.IsRemoved {
			t.Errorf("worker %s should not be marked as removed", w.WorkerID)
		}
	}
}

func TestGetImageStorageStatsByWorkerOrphanFileNoDB(t *testing.T) {
	svc, uploadDir := setupTestService(t)
	ctx := context.Background()

	// File on disk but NO TaskMetadata entry → orphan
	createTestFile(t, uploadDir, "orphan_file.jpg", "orphandata")

	stats, err := svc.GetImageStorageStatsByWorker(ctx)
	if err != nil {
		t.Fatalf(unexpectedErrFmt, err)
	}
	if stats.OrphanCount != 1 {
		t.Errorf("expected 1 orphan, got %d", stats.OrphanCount)
	}
	if stats.TotalImageCount != 1 {
		t.Errorf("expected 1 total image, got %d", stats.TotalImageCount)
	}
}

func TestGetImageStorageStatsByWorkerOrphanNoTaskState(t *testing.T) {
	svc, uploadDir := setupTestService(t)
	ctx := context.Background()

	// File exists, TaskMetadata exists, but NO TaskState → orphan (task removed from worker)
	file := createTestFile(t, uploadDir, "hash_no_state.jpg", "data")
	seedTaskMetadata(t, svc, "hash_no_state", file)

	stats, err := svc.GetImageStorageStatsByWorker(ctx)
	if err != nil {
		t.Fatalf(unexpectedErrFmt, err)
	}
	if stats.OrphanCount != 1 {
		t.Errorf("expected 1 orphan (no TaskState), got %d", stats.OrphanCount)
	}
}

func TestGetImageStorageStatsByWorkerRemovedWorker(t *testing.T) {
	svc, uploadDir := setupTestService(t)
	ctx := context.Background()

	// Worker exists in TaskState but NOT in Worker table → is_removed = true
	removedWorkerID := uuid.New().String()
	file := createTestFile(t, uploadDir, "hash_removed.jpg", "content")
	seedTaskMetadata(t, svc, "hash_removed", file)
	seedTaskState(t, svc, removedWorkerID, "hash_removed")
	// Do NOT seed worker in workers table

	stats, err := svc.GetImageStorageStatsByWorker(ctx)
	if err != nil {
		t.Fatalf(unexpectedErrFmt, err)
	}
	if len(stats.Workers) != 1 {
		t.Fatalf("expected 1 worker entry, got %d", len(stats.Workers))
	}
	if !stats.Workers[0].IsRemoved {
		t.Error("expected worker to be marked as removed")
	}
	if stats.Workers[0].ImageCount != 1 {
		t.Errorf("expected 1 image for removed worker, got %d", stats.Workers[0].ImageCount)
	}
}

// ---------------------------------------------------------------------------
// Tests for DeleteImagesByWorker
// ---------------------------------------------------------------------------

func TestDeleteImagesByWorkerDeletesFilesAndClearsDB(t *testing.T) {
	svc, uploadDir := setupTestService(t)
	ctx := context.Background()

	workerID := seedWorker(t, svc, "Worker-Del")
	file1 := createTestFile(t, uploadDir, "del1.jpg", "file1data")
	file2 := createTestFile(t, uploadDir, "del2.jpg", "file2data")
	seedTaskMetadata(t, svc, "del1", file1)
	seedTaskMetadata(t, svc, "del2", file2)
	seedTaskState(t, svc, workerID, "del1")
	seedTaskState(t, svc, workerID, "del2")

	deleted, err := svc.DeleteImagesByWorker(ctx, workerID)
	if err != nil {
		t.Fatalf(unexpectedErrFmt, err)
	}
	if deleted != 2 {
		t.Errorf("expected 2 deleted, got %d", deleted)
	}

	// Verify files are gone
	if _, err := os.Stat(file1); !os.IsNotExist(err) {
		t.Error("file1 should have been deleted")
	}
	if _, err := os.Stat(file2); !os.IsNotExist(err) {
		t.Error("file2 should have been deleted")
	}

	// Verify DB image_path is cleared
	meta1, _ := svc.repo.GetByTaskHash(ctx, "del1")
	if meta1 != nil && meta1.ImagePath != "" {
		t.Errorf("expected image_path to be cleared for del1, got %q", meta1.ImagePath)
	}
	meta2, _ := svc.repo.GetByTaskHash(ctx, "del2")
	if meta2 != nil && meta2.ImagePath != "" {
		t.Errorf("expected image_path to be cleared for del2, got %q", meta2.ImagePath)
	}
}

func TestDeleteImagesByWorkerDoesNotAffectOtherWorkers(t *testing.T) {
	svc, uploadDir := setupTestService(t)
	ctx := context.Background()

	worker1 := seedWorker(t, svc, "Worker-Keep")
	worker2 := seedWorker(t, svc, "Worker-Remove")

	fileKeep := createTestFile(t, uploadDir, "keep.jpg", "keep")
	fileRemove := createTestFile(t, uploadDir, "remove.jpg", "remove")
	seedTaskMetadata(t, svc, "keep", fileKeep)
	seedTaskMetadata(t, svc, "remove", fileRemove)
	seedTaskState(t, svc, worker1, "keep")
	seedTaskState(t, svc, worker2, "remove")

	deleted, err := svc.DeleteImagesByWorker(ctx, worker2)
	if err != nil {
		t.Fatalf(unexpectedErrFmt, err)
	}
	if deleted != 1 {
		t.Errorf("expected 1 deleted, got %d", deleted)
	}

	// Worker1's file should still exist
	if _, err := os.Stat(fileKeep); os.IsNotExist(err) {
		t.Error("worker1 file should NOT have been deleted")
	}

	// Worker1's DB entry should still have image_path
	meta, _ := svc.repo.GetByTaskHash(ctx, "keep")
	if meta == nil || meta.ImagePath == "" {
		t.Error("worker1 metadata image_path should still be set")
	}
}

func TestDeleteImagesByWorkerNoTasks(t *testing.T) {
	svc, _ := setupTestService(t)
	ctx := context.Background()

	deleted, err := svc.DeleteImagesByWorker(ctx, uuid.New().String())
	if err != nil {
		t.Fatalf(unexpectedErrFmt, err)
	}
	if deleted != 0 {
		t.Errorf("expected 0 deleted for non-existent worker, got %d", deleted)
	}
}

func TestNewServiceUsesDedicatedHTTPClientTimeout(t *testing.T) {
	svc, _ := setupTestService(t)

	if svc.httpClient == nil {
		t.Fatal("expected http client to be initialized")
	}
	if svc.httpClient == http.DefaultClient {
		t.Fatal("expected a dedicated http client instance")
	}
	if svc.httpClient.Timeout != httpTimeout {
		t.Fatalf("expected timeout %v, got %v", httpTimeout, svc.httpClient.Timeout)
	}
}

func TestDeleteImagePreservesMetadataWhenOtherFieldsRemain(t *testing.T) {
	svc, uploadDir := setupTestService(t)
	ctx := context.Background()

	imagePath := createTestFile(t, uploadDir, "keep-metadata.jpg", "image")
	createTestMetadata(t, svc, &models.TaskMetadata{
		TaskHash:    "keep-meta",
		ImagePath:   imagePath,
		Name:        "Existing Name",
		ReleaseDate: "2024-02-03",
	})

	if err := svc.DeleteImage(ctx, "keep-meta"); err != nil {
		t.Fatalf(unexpectedErrFmt, err)
	}

	metadata, err := svc.repo.GetByTaskHash(ctx, "keep-meta")
	if err != nil {
		t.Fatalf(unexpectedErrFmt, err)
	}
	if metadata == nil {
		t.Fatal("expected metadata row to be preserved")
	}
	if metadata.ImagePath != "" {
		t.Fatalf("expected image path to be cleared, got %q", metadata.ImagePath)
	}
	if metadata.Name != "Existing Name" {
		t.Fatalf("expected name to be preserved, got %q", metadata.Name)
	}
	if metadata.ReleaseDate != "2024-02-03" {
		t.Fatalf("expected release date to be preserved, got %q", metadata.ReleaseDate)
	}
	if _, err := os.Stat(imagePath); !os.IsNotExist(err) {
		t.Fatal("expected deleted image file to be removed")
	}
}

func TestDeleteImageDeletesMetadataWhenNoFieldsRemain(t *testing.T) {
	svc, uploadDir := setupTestService(t)
	ctx := context.Background()

	imagePath := createTestFile(t, uploadDir, "delete-empty.jpg", "image")
	createTestMetadata(t, svc, &models.TaskMetadata{
		TaskHash:  "delete-empty",
		ImagePath: imagePath,
	})

	if err := svc.DeleteImage(ctx, "delete-empty"); err != nil {
		t.Fatalf(unexpectedErrFmt, err)
	}

	metadata, err := svc.repo.GetByTaskHash(ctx, "delete-empty")
	if err != nil {
		t.Fatalf(unexpectedErrFmt, err)
	}
	if metadata != nil {
		t.Fatal("expected metadata row to be deleted")
	}
	if _, err := os.Stat(imagePath); !os.IsNotExist(err) {
		t.Fatal("expected deleted image file to be removed")
	}
}

// ---------------------------------------------------------------------------
// Tests for DeleteOrphanImages
// ---------------------------------------------------------------------------

func TestDeleteOrphanImagesRemovesStaleOrphans(t *testing.T) {
	svc, uploadDir := setupTestService(t)
	ctx := context.Background()

	// File has TaskMetadata but NO TaskState → stale orphan (should be deleted)
	staleFile := createTestFile(t, uploadDir, "stale.jpg", "staledata")
	seedTaskMetadata(t, svc, "stale_hash", staleFile)

	// File properly linked to a worker → should NOT be deleted
	worker := seedWorker(t, svc, "Active-Worker")
	linkedFile := createTestFile(t, uploadDir, "linked.jpg", "linkeddata")
	seedTaskMetadata(t, svc, "linked_hash", linkedFile)
	seedTaskState(t, svc, worker, "linked_hash")

	deleted, err := svc.DeleteOrphanImages(ctx)
	if err != nil {
		t.Fatalf(unexpectedErrFmt, err)
	}
	if deleted != 1 {
		t.Errorf("expected 1 stale orphan deleted, got %d", deleted)
	}

	// Stale file should be gone
	if _, err := os.Stat(staleFile); !os.IsNotExist(err) {
		t.Error("stale orphan file should have been deleted")
	}

	// Linked file should still exist
	if _, err := os.Stat(linkedFile); os.IsNotExist(err) {
		t.Error("linked file should NOT have been deleted")
	}

	// Stale metadata image_path should be cleared in DB
	meta, _ := svc.repo.GetByTaskHash(ctx, "stale_hash")
	if meta != nil && meta.ImagePath != "" {
		t.Errorf("stale orphan image_path should be cleared, got %q", meta.ImagePath)
	}
}

func TestDeleteOrphanImagesRemovesUnreferencedFiles(t *testing.T) {
	svc, uploadDir := setupTestService(t)
	ctx := context.Background()

	// Create an orphan file (no TaskMetadata)
	orphan := createTestFile(t, uploadDir, "orphan.jpg", "orphandata")

	// Create a referenced file (has TaskMetadata + TaskState)
	worker := seedWorker(t, svc, "Worker-Ref")
	referenced := createTestFile(t, uploadDir, "ref.jpg", "refdata")
	seedTaskMetadata(t, svc, "ref_hash", referenced)
	seedTaskState(t, svc, worker, "ref_hash")

	deleted, err := svc.DeleteOrphanImages(ctx)
	if err != nil {
		t.Fatalf(unexpectedErrFmt, err)
	}
	if deleted != 1 {
		t.Errorf("expected 1 orphan deleted, got %d", deleted)
	}

	// Orphan should be gone
	if _, err := os.Stat(orphan); !os.IsNotExist(err) {
		t.Error("orphan file should have been deleted")
	}

	// Referenced file should still exist
	if _, err := os.Stat(referenced); os.IsNotExist(err) {
		t.Error("referenced file should NOT have been deleted")
	}
}

func TestDeleteOrphanImagesNoOrphans(t *testing.T) {
	svc, uploadDir := setupTestService(t)
	ctx := context.Background()

	// All files are fully referenced (TaskMetadata + TaskState)
	worker := seedWorker(t, svc, "Worker-Good")
	file := createTestFile(t, uploadDir, "good.jpg", "gooddata")
	seedTaskMetadata(t, svc, "good_hash", file)
	seedTaskState(t, svc, worker, "good_hash")

	deleted, err := svc.DeleteOrphanImages(ctx)
	if err != nil {
		t.Fatalf(unexpectedErrFmt, err)
	}
	if deleted != 0 {
		t.Errorf("expected 0 orphans deleted, got %d", deleted)
	}
}

func TestDeleteOrphanImagesEmptyDir(t *testing.T) {
	svc, _ := setupTestService(t)
	ctx := context.Background()

	deleted, err := svc.DeleteOrphanImages(ctx)
	if err != nil {
		t.Fatalf(unexpectedErrFmt, err)
	}
	if deleted != 0 {
		t.Errorf("expected 0 deleted for empty dir, got %d", deleted)
	}
}

func TestValidateExternalImageURLRejectsMalformedURL(t *testing.T) {
	svc, _ := setupTestService(t)
	provider := mockMetadataProvider{name: "tgdb", allowedImageHosts: []string{"cdn.thegamesdb.net"}}

	_, _, err := svc.validateExternalImageURL(context.Background(), provider, "://bad-url")
	if err == nil {
		t.Fatal("expected malformed URL to be rejected")
	}
}

func TestValidateExternalImageURLRejectsNonHTTPS(t *testing.T) {
	svc, _ := setupTestService(t)
	provider := mockMetadataProvider{name: "tgdb", allowedImageHosts: []string{"cdn.thegamesdb.net"}}

	_, _, err := svc.validateExternalImageURL(context.Background(), provider, "http://cdn.thegamesdb.net/images/test.jpg")
	if err == nil || !strings.Contains(err.Error(), "only https URLs are allowed") {
		t.Fatalf("expected non-https URL rejection, got %v", err)
	}
}

func TestValidateExternalImageURLRejectsUntrustedHost(t *testing.T) {
	svc, _ := setupTestService(t)
	provider := mockMetadataProvider{name: "tgdb", allowedImageHosts: []string{"cdn.thegamesdb.net"}}

	_, _, err := svc.validateExternalImageURL(context.Background(), provider, "https://example.com/image.jpg")
	if err == nil || !strings.Contains(err.Error(), "untrusted host") {
		t.Fatalf("expected untrusted host rejection, got %v", err)
	}
}

func TestValidateExternalImageURLRejectsPrivateIP(t *testing.T) {
	svc, _ := setupTestService(t)
	provider := mockMetadataProvider{name: "tgdb", allowedImageHosts: []string{"cdn.thegamesdb.net"}}
	svc.lookupIPAddr = func(context.Context, string) ([]net.IPAddr, error) {
		return []net.IPAddr{{IP: net.ParseIP("127.0.0.1")}}, nil
	}

	_, _, err := svc.validateExternalImageURL(context.Background(), provider, "https://cdn.thegamesdb.net/images/test.jpg")
	if err == nil || !strings.Contains(err.Error(), "disallowed IP address") {
		t.Fatalf("expected private IP rejection, got %v", err)
	}
}

func TestValidateExternalImageURLRejectsQueryString(t *testing.T) {
	svc, _ := setupTestService(t)
	provider := mockMetadataProvider{name: "tgdb", allowedImageHosts: []string{"cdn.thegamesdb.net"}}

	_, _, err := svc.validateExternalImageURL(context.Background(), provider, "https://cdn.thegamesdb.net/images/test.jpg?token=123")
	if err == nil || !strings.Contains(err.Error(), "query strings and fragments are not allowed") {
		t.Fatalf("expected query string rejection, got %v", err)
	}
}

func TestValidateExternalImageURLRejectsExplicitPort(t *testing.T) {
	svc, _ := setupTestService(t)
	provider := mockMetadataProvider{name: "tgdb", allowedImageHosts: []string{"cdn.thegamesdb.net"}}

	_, _, err := svc.validateExternalImageURL(context.Background(), provider, "https://cdn.thegamesdb.net:443/images/test.jpg")
	if err == nil || !strings.Contains(err.Error(), "explicit ports are not allowed") {
		t.Fatalf("expected explicit port rejection, got %v", err)
	}
}

func TestApplyProviderSelectionAcceptsTrustedProviderImage(t *testing.T) {
	svc, uploadDir := setupTestService(t)
	svc.providerRegistry = NewMetadataProviderRegistry(mockMetadataProvider{
		name:              "tgdb",
		allowedImageHosts: []string{"cdn.thegamesdb.net"},
		selection: &MetadataProviderSelection{
			ID:          "123",
			Title:       "My Game",
			ReleaseDate: "2024-01-01",
			Description: "description",
			ImageURL:    "https://cdn.thegamesdb.net/images/large/boxart/front/123.jpg",
		},
	})
	svc.lookupIPAddr = func(context.Context, string) ([]net.IPAddr, error) {
		return []net.IPAddr{{IP: net.ParseIP("203.0.113.10")}}, nil
	}
	svc.httpClient = &http.Client{
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			if req.URL.Hostname() != "cdn.thegamesdb.net" {
				return nil, fmt.Errorf("unexpected host: %s", req.URL.Hostname())
			}
			return &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(bytes.NewReader(testPNGBytes())),
				Header: http.Header{
					"Content-Type": []string{"image/png"},
				},
			}, nil
		}),
	}

	result, err := svc.ApplyProviderSelection(
		context.Background(),
		"tgdb",
		"task123",
		"123",
	)
	if err != nil {
		t.Fatalf(unexpectedErrFmt, err)
	}
	if result == nil || result.ImagePath == "" {
		t.Fatal("expected image path to be set")
	}
	if _, err := os.Stat(result.ImagePath); err != nil {
		t.Fatalf("expected downloaded image to exist: %v", err)
	}
	if !strings.HasPrefix(result.ImagePath, uploadDir) {
		t.Fatalf("expected image path under upload dir, got %s", result.ImagePath)
	}
	if filepath.Ext(result.ImagePath) != ".png" {
		t.Fatalf("expected detected .png extension to be used, got %s", result.ImagePath)
	}
}

func TestApplyProviderSelectionDeletesOldImageAfterSuccessfulUpdate(t *testing.T) {
	svc, uploadDir := setupTestService(t)
	ctx := context.Background()
	svc.providerRegistry = NewMetadataProviderRegistry(mockMetadataProvider{
		name:              "tgdb",
		allowedImageHosts: []string{"cdn.thegamesdb.net"},
		selection: &MetadataProviderSelection{
			ID:          "123",
			Title:       "New Name",
			ReleaseDate: "2024-05-01",
			Description: "New description",
			ImageURL:    "https://cdn.thegamesdb.net/images/large/boxart/front/123.jpg",
		},
	})
	svc.lookupIPAddr = func(context.Context, string) ([]net.IPAddr, error) {
		return []net.IPAddr{{IP: net.ParseIP("203.0.113.10")}}, nil
	}
	svc.httpClient = &http.Client{
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			return &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(bytes.NewReader(testPNGBytes())),
				Header: http.Header{
					"Content-Type": []string{"image/png"},
				},
			}, nil
		}),
	}

	oldImagePath := createTestFile(t, uploadDir, "old-image.jpg", "old")
	createTestMetadata(t, svc, &models.TaskMetadata{
		TaskHash:    "task-update-success",
		Name:        "Old Name",
		Description: "Old description",
		ImagePath:   oldImagePath,
	})

	result, err := svc.ApplyProviderSelection(
		ctx,
		"tgdb",
		"task-update-success",
		"123",
	)
	if err != nil {
		t.Fatalf(unexpectedErrFmt, err)
	}
	if result == nil || result.ImagePath == "" {
		t.Fatal("expected updated metadata with image path")
	}
	if result.ImagePath == oldImagePath {
		t.Fatal("expected a newly downloaded image path")
	}
	if _, err := os.Stat(result.ImagePath); err != nil {
		t.Fatalf("expected new image to exist: %v", err)
	}
	if _, err := os.Stat(oldImagePath); !os.IsNotExist(err) {
		t.Fatal("expected old image to be removed after successful update")
	}

	stored, err := svc.repo.GetByTaskHash(ctx, "task-update-success")
	if err != nil {
		t.Fatalf(unexpectedErrFmt, err)
	}
	if stored == nil || stored.ImagePath != result.ImagePath {
		t.Fatal("expected database to reference the new image path")
	}
}

func TestApplyProviderSelectionRemovesNewImageWhenUpdateFails(t *testing.T) {
	svc, uploadDir := setupTestService(t)
	ctx := context.Background()
	svc.providerRegistry = NewMetadataProviderRegistry(mockMetadataProvider{
		name:              "tgdb",
		allowedImageHosts: []string{"cdn.thegamesdb.net"},
		selection: &MetadataProviderSelection{
			ID:          "123",
			Title:       "New Name",
			ReleaseDate: "2024-05-01",
			Description: "New description",
			ImageURL:    "https://cdn.thegamesdb.net/images/large/boxart/front/123.jpg",
		},
	})
	svc.lookupIPAddr = func(context.Context, string) ([]net.IPAddr, error) {
		return []net.IPAddr{{IP: net.ParseIP("203.0.113.10")}}, nil
	}
	svc.httpClient = &http.Client{
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			return &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(bytes.NewReader(testPNGBytes())),
				Header: http.Header{
					"Content-Type": []string{"image/png"},
				},
			}, nil
		}),
	}

	oldImagePath := createTestFile(t, uploadDir, "old-image-failure.jpg", "old")
	createTestMetadata(t, svc, &models.TaskMetadata{
		TaskHash:    "task-update-failure",
		Name:        "Old Name",
		Description: "Old description",
		ImagePath:   oldImagePath,
	})

	callbackName := "test:fail_task_metadata_update"
	if err := svc.db.DB.Callback().Update().Before("gorm:update").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Schema != nil && tx.Statement.Schema.Table == "task_metadata" {
			tx.AddError(errors.New("forced update failure"))
		}
	}); err != nil {
		t.Fatalf("failed to register update callback: %v", err)
	}
	defer func() {
		_ = svc.db.DB.Callback().Update().Remove(callbackName)
	}()

	result, err := svc.ApplyProviderSelection(
		ctx,
		"tgdb",
		"task-update-failure",
		"123",
	)
	if err == nil || !strings.Contains(err.Error(), "forced update failure") {
		t.Fatalf("expected forced update failure, got result=%v err=%v", result, err)
	}

	stored, repoErr := svc.repo.GetByTaskHash(ctx, "task-update-failure")
	if repoErr != nil {
		t.Fatalf(unexpectedErrFmt, repoErr)
	}
	if stored == nil {
		t.Fatal("expected original metadata row to remain")
	}
	if stored.ImagePath != oldImagePath {
		t.Fatalf("expected database to keep old image path, got %q", stored.ImagePath)
	}
	if _, err := os.Stat(oldImagePath); err != nil {
		t.Fatalf("expected old image to remain after failed update: %v", err)
	}

	entries, readErr := os.ReadDir(uploadDir)
	if readErr != nil {
		t.Fatalf("failed to read upload dir: %v", readErr)
	}
	if len(entries) != 1 || entries[0].Name() != filepath.Base(oldImagePath) {
		t.Fatalf("expected only the original image to remain, found %v", entries)
	}
}

func TestApplyProviderSelectionRejectsOversizedImage(t *testing.T) {
	svc, uploadDir := setupTestService(t)
	svc.providerRegistry = NewMetadataProviderRegistry(mockMetadataProvider{
		name:              "tgdb",
		allowedImageHosts: []string{"cdn.thegamesdb.net"},
		selection: &MetadataProviderSelection{
			ID:          "123",
			Title:       "My Game",
			ReleaseDate: "2024-01-01",
			Description: "description",
			ImageURL:    "https://cdn.thegamesdb.net/images/large/boxart/front/123.jpg",
		},
	})
	svc.lookupIPAddr = func(context.Context, string) ([]net.IPAddr, error) {
		return []net.IPAddr{{IP: net.ParseIP("203.0.113.10")}}, nil
	}

	oversizedBody := append(testPNGBytes(), bytes.Repeat([]byte("a"), MaxFileSize)...)
	svc.httpClient = &http.Client{
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			return &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(bytes.NewReader(oversizedBody)),
				Header: http.Header{
					"Content-Type": []string{"image/png"},
				},
			}, nil
		}),
	}

	_, err := svc.ApplyProviderSelection(
		context.Background(),
		"tgdb",
		"task123",
		"123",
	)
	if err == nil || !strings.Contains(err.Error(), "image size exceeds maximum allowed size") {
		t.Fatalf("expected oversized image rejection, got %v", err)
	}

	entries, readErr := os.ReadDir(uploadDir)
	if readErr != nil {
		t.Fatalf("failed to read upload dir: %v", readErr)
	}
	if len(entries) != 0 {
		t.Fatalf("expected no files to be written for oversized image, found %d", len(entries))
	}
}

func TestApplyProviderSelectionRejectsNonImageContent(t *testing.T) {
	svc, uploadDir := setupTestService(t)
	svc.providerRegistry = NewMetadataProviderRegistry(mockMetadataProvider{
		name:              "tgdb",
		allowedImageHosts: []string{"cdn.thegamesdb.net"},
		selection: &MetadataProviderSelection{
			ID:          "123",
			Title:       "My Game",
			ReleaseDate: "2024-01-01",
			Description: "description",
			ImageURL:    "https://cdn.thegamesdb.net/images/large/boxart/front/123.jpg",
		},
	})
	svc.lookupIPAddr = func(context.Context, string) ([]net.IPAddr, error) {
		return []net.IPAddr{{IP: net.ParseIP("203.0.113.10")}}, nil
	}
	svc.httpClient = &http.Client{
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			return &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(strings.NewReader("not-an-image")),
				Header: http.Header{
					"Content-Type": []string{"text/plain"},
				},
			}, nil
		}),
	}

	_, err := svc.ApplyProviderSelection(
		context.Background(),
		"tgdb",
		"task123",
		"123",
	)
	if err == nil || !strings.Contains(err.Error(), "invalid image content type") {
		t.Fatalf("expected non-image rejection, got %v", err)
	}

	entries, readErr := os.ReadDir(uploadDir)
	if readErr != nil {
		t.Fatalf("failed to read upload dir: %v", readErr)
	}
	if len(entries) != 0 {
		t.Fatalf("expected no files to be written for invalid image, found %d", len(entries))
	}
}

func TestApplyProviderSelectionUsesDetectedExtensionWhenURLHasNoValidImageExt(t *testing.T) {
	svc, _ := setupTestService(t)
	svc.providerRegistry = NewMetadataProviderRegistry(mockMetadataProvider{
		name:              "tgdb",
		allowedImageHosts: []string{"cdn.thegamesdb.net"},
		selection: &MetadataProviderSelection{
			ID:          "123",
			Title:       "My Game",
			ReleaseDate: "2024-01-01",
			Description: "description",
			ImageURL:    "https://cdn.thegamesdb.net/images/large/boxart/front/123.txt",
		},
	})
	svc.lookupIPAddr = func(context.Context, string) ([]net.IPAddr, error) {
		return []net.IPAddr{{IP: net.ParseIP("203.0.113.10")}}, nil
	}
	svc.httpClient = &http.Client{
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			return &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(bytes.NewReader(testPNGBytes())),
				Header: http.Header{
					"Content-Type": []string{"image/png"},
				},
			}, nil
		}),
	}

	result, err := svc.ApplyProviderSelection(
		context.Background(),
		"tgdb",
		"task123",
		"123",
	)
	if err != nil {
		t.Fatalf(unexpectedErrFmt, err)
	}
	if filepath.Ext(result.ImagePath) != ".png" {
		t.Fatalf("expected detected .png extension, got %s", result.ImagePath)
	}
}

func testPNGBytes() []byte {
	return []byte{
		0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
		0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
		0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
		0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
		0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,
		0x54, 0x78, 0x9C, 0x63, 0x60, 0x00, 0x00, 0x00,
		0x02, 0x00, 0x01, 0xE5, 0x27, 0xD4, 0xA2, 0x00,
		0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
		0x42, 0x60, 0x82,
	}
}

type mockMetadataProvider struct {
	name              string
	allowedImageHosts []string
	selection         *MetadataProviderSelection
	resolveErr        error
}

func (m mockMetadataProvider) Name() string {
	return m.name
}

func (m mockMetadataProvider) Status(context.Context) (*MetadataProviderStatus, error) {
	return &MetadataProviderStatus{Provider: m.name, Active: true}, nil
}

func (m mockMetadataProvider) Search(context.Context, string) ([]MetadataProviderSearchResult, error) {
	return nil, nil
}

func (m mockMetadataProvider) Resolve(context.Context, string) (*MetadataProviderSelection, error) {
	if m.resolveErr != nil {
		return nil, m.resolveErr
	}
	if m.selection == nil {
		return nil, ErrProviderSelectionNotFound
	}
	return m.selection, nil
}

func (m mockMetadataProvider) AllowedImageHosts() []string {
	return m.allowedImageHosts
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}
