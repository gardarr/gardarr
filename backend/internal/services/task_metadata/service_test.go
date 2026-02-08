package task_metadata

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jfxdev/gardarr/internal/infra/database"
	"github.com/jfxdev/gardarr/internal/models"
)

// setupTestService creates a Service with an in-memory DB and a temp uploadDir.
// It auto-migrates TaskMetadata, TaskState, and Agent tables.
func setupTestService(t *testing.T) (*Service, string) {
	t.Helper()
	db := database.SetupTestDB(t, &models.TaskMetadata{}, &models.TaskState{}, &models.Agent{})

	uploadDir := t.TempDir()

	svc, err := NewService(db, "http://localhost:3200", uploadDir)
	if err != nil {
		t.Fatalf("NewService failed: %v", err)
	}
	return svc, uploadDir
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

// seedAgent inserts an agent into the DB and returns its UUID string.
func seedAgent(t *testing.T, svc *Service, name string) string {
	t.Helper()
	agentUUID := uuid.New().String()
	if err := svc.db.DB.Exec(
		"INSERT INTO agents (uuid, name, type, address, encrypeted_token, icon, color, created_at, updated_at) VALUES (?, ?, 'qbt', 'http://test', 'tok', '', '', ?, ?)",
		agentUUID, name, time.Now(), time.Now(),
	).Error; err != nil {
		t.Fatalf("seed agent failed: %v", err)
	}
	return agentUUID
}

// seedTaskState inserts a task_state row linking a hash to an agent.
func seedTaskState(t *testing.T, svc *Service, agentID, hash string) {
	t.Helper()
	if err := svc.db.DB.Exec(
		"INSERT INTO task_states (agent_id, hash, state, progress, updated_at) VALUES (?, ?, 'seeding', 100, ?)",
		agentID, hash, time.Now(),
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
// Tests for GetImageStorageStatsByAgent
// ---------------------------------------------------------------------------

func TestGetImageStorageStatsByAgent_Empty(t *testing.T) {
	svc, _ := setupTestService(t)
	ctx := context.Background()

	stats, err := svc.GetImageStorageStatsByAgent(ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
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

func TestGetImageStorageStatsByAgent_PerAgent(t *testing.T) {
	svc, uploadDir := setupTestService(t)
	ctx := context.Background()

	// Setup: 2 agents, each with 1 image file
	agent1 := seedAgent(t, svc, "Agent-1")
	agent2 := seedAgent(t, svc, "Agent-2")

	file1 := createTestFile(t, uploadDir, "hash1_img.jpg", "aaaa") // 4 bytes
	file2 := createTestFile(t, uploadDir, "hash2_img.jpg", "bbbbbb") // 6 bytes

	seedTaskMetadata(t, svc, "hash1", file1)
	seedTaskMetadata(t, svc, "hash2", file2)
	seedTaskState(t, svc, agent1, "hash1")
	seedTaskState(t, svc, agent2, "hash2")

	stats, err := svc.GetImageStorageStatsByAgent(ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
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
	if len(stats.Agents) != 2 {
		t.Fatalf("expected 2 agents, got %d", len(stats.Agents))
	}

	// Check agents are active (not removed)
	for _, a := range stats.Agents {
		if a.IsRemoved {
			t.Errorf("agent %s should not be marked as removed", a.AgentID)
		}
	}
}

func TestGetImageStorageStatsByAgent_OrphanFileNoDB(t *testing.T) {
	svc, uploadDir := setupTestService(t)
	ctx := context.Background()

	// File on disk but NO TaskMetadata entry → orphan
	createTestFile(t, uploadDir, "orphan_file.jpg", "orphandata")

	stats, err := svc.GetImageStorageStatsByAgent(ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if stats.OrphanCount != 1 {
		t.Errorf("expected 1 orphan, got %d", stats.OrphanCount)
	}
	if stats.TotalImageCount != 1 {
		t.Errorf("expected 1 total image, got %d", stats.TotalImageCount)
	}
}

func TestGetImageStorageStatsByAgent_OrphanNoTaskState(t *testing.T) {
	svc, uploadDir := setupTestService(t)
	ctx := context.Background()

	// File exists, TaskMetadata exists, but NO TaskState → orphan (task removed from agent)
	file := createTestFile(t, uploadDir, "hash_no_state.jpg", "data")
	seedTaskMetadata(t, svc, "hash_no_state", file)

	stats, err := svc.GetImageStorageStatsByAgent(ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if stats.OrphanCount != 1 {
		t.Errorf("expected 1 orphan (no TaskState), got %d", stats.OrphanCount)
	}
}

func TestGetImageStorageStatsByAgent_RemovedAgent(t *testing.T) {
	svc, uploadDir := setupTestService(t)
	ctx := context.Background()

	// Agent exists in TaskState but NOT in Agent table → is_removed = true
	removedAgentID := uuid.New().String()
	file := createTestFile(t, uploadDir, "hash_removed.jpg", "content")
	seedTaskMetadata(t, svc, "hash_removed", file)
	seedTaskState(t, svc, removedAgentID, "hash_removed")
	// Do NOT seed agent in agents table

	stats, err := svc.GetImageStorageStatsByAgent(ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(stats.Agents) != 1 {
		t.Fatalf("expected 1 agent entry, got %d", len(stats.Agents))
	}
	if !stats.Agents[0].IsRemoved {
		t.Error("expected agent to be marked as removed")
	}
	if stats.Agents[0].ImageCount != 1 {
		t.Errorf("expected 1 image for removed agent, got %d", stats.Agents[0].ImageCount)
	}
}

// ---------------------------------------------------------------------------
// Tests for DeleteImagesByAgent
// ---------------------------------------------------------------------------

func TestDeleteImagesByAgent_DeletesFilesAndClearsDB(t *testing.T) {
	svc, uploadDir := setupTestService(t)
	ctx := context.Background()

	agentID := seedAgent(t, svc, "Agent-Del")
	file1 := createTestFile(t, uploadDir, "del1.jpg", "file1data")
	file2 := createTestFile(t, uploadDir, "del2.jpg", "file2data")
	seedTaskMetadata(t, svc, "del1", file1)
	seedTaskMetadata(t, svc, "del2", file2)
	seedTaskState(t, svc, agentID, "del1")
	seedTaskState(t, svc, agentID, "del2")

	deleted, err := svc.DeleteImagesByAgent(ctx, agentID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
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

func TestDeleteImagesByAgent_DoesNotAffectOtherAgents(t *testing.T) {
	svc, uploadDir := setupTestService(t)
	ctx := context.Background()

	agent1 := seedAgent(t, svc, "Agent-Keep")
	agent2 := seedAgent(t, svc, "Agent-Remove")

	fileKeep := createTestFile(t, uploadDir, "keep.jpg", "keep")
	fileRemove := createTestFile(t, uploadDir, "remove.jpg", "remove")
	seedTaskMetadata(t, svc, "keep", fileKeep)
	seedTaskMetadata(t, svc, "remove", fileRemove)
	seedTaskState(t, svc, agent1, "keep")
	seedTaskState(t, svc, agent2, "remove")

	deleted, err := svc.DeleteImagesByAgent(ctx, agent2)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if deleted != 1 {
		t.Errorf("expected 1 deleted, got %d", deleted)
	}

	// Agent1's file should still exist
	if _, err := os.Stat(fileKeep); os.IsNotExist(err) {
		t.Error("agent1 file should NOT have been deleted")
	}

	// Agent1's DB entry should still have image_path
	meta, _ := svc.repo.GetByTaskHash(ctx, "keep")
	if meta == nil || meta.ImagePath == "" {
		t.Error("agent1 metadata image_path should still be set")
	}
}

func TestDeleteImagesByAgent_NoTasks(t *testing.T) {
	svc, _ := setupTestService(t)
	ctx := context.Background()

	deleted, err := svc.DeleteImagesByAgent(ctx, uuid.New().String())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if deleted != 0 {
		t.Errorf("expected 0 deleted for non-existent agent, got %d", deleted)
	}
}

// ---------------------------------------------------------------------------
// Tests for DeleteOrphanImages
// ---------------------------------------------------------------------------

func TestDeleteOrphanImages_RemovesStaleOrphans(t *testing.T) {
	svc, uploadDir := setupTestService(t)
	ctx := context.Background()

	// File has TaskMetadata but NO TaskState → stale orphan (should be deleted)
	staleFile := createTestFile(t, uploadDir, "stale.jpg", "staledata")
	seedTaskMetadata(t, svc, "stale_hash", staleFile)

	// File properly linked to an agent → should NOT be deleted
	agent := seedAgent(t, svc, "Active-Agent")
	linkedFile := createTestFile(t, uploadDir, "linked.jpg", "linkeddata")
	seedTaskMetadata(t, svc, "linked_hash", linkedFile)
	seedTaskState(t, svc, agent, "linked_hash")

	deleted, err := svc.DeleteOrphanImages(ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
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

func TestDeleteOrphanImages_RemovesUnreferencedFiles(t *testing.T) {
	svc, uploadDir := setupTestService(t)
	ctx := context.Background()

	// Create an orphan file (no TaskMetadata)
	orphan := createTestFile(t, uploadDir, "orphan.jpg", "orphandata")

	// Create a referenced file (has TaskMetadata + TaskState)
	agent := seedAgent(t, svc, "Agent-Ref")
	referenced := createTestFile(t, uploadDir, "ref.jpg", "refdata")
	seedTaskMetadata(t, svc, "ref_hash", referenced)
	seedTaskState(t, svc, agent, "ref_hash")

	deleted, err := svc.DeleteOrphanImages(ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
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

func TestDeleteOrphanImages_NoOrphans(t *testing.T) {
	svc, uploadDir := setupTestService(t)
	ctx := context.Background()

	// All files are fully referenced (TaskMetadata + TaskState)
	agent := seedAgent(t, svc, "Agent-Good")
	file := createTestFile(t, uploadDir, "good.jpg", "gooddata")
	seedTaskMetadata(t, svc, "good_hash", file)
	seedTaskState(t, svc, agent, "good_hash")

	deleted, err := svc.DeleteOrphanImages(ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if deleted != 0 {
		t.Errorf("expected 0 orphans deleted, got %d", deleted)
	}
}

func TestDeleteOrphanImages_EmptyDir(t *testing.T) {
	svc, _ := setupTestService(t)
	ctx := context.Background()

	deleted, err := svc.DeleteOrphanImages(ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if deleted != 0 {
		t.Errorf("expected 0 deleted for empty dir, got %d", deleted)
	}
}
