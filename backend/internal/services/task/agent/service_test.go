package task

import (
	"context"
	"errors"
	"testing"

	"github.com/gardarr/gardarr/internal/entities"
	"github.com/gardarr/gardarr/internal/schemas"
)

// mockRepository is a mock implementation of the task repository for testing
type mockRepository struct {
	tasks       map[string]*entities.Task
	stopError   error
	startError  error
	forceError  error
	deleteError error
	createError error
}

func newMockRepository() *mockRepository {
	return &mockRepository{
		tasks: make(map[string]*entities.Task),
	}
}

func (m *mockRepository) List() ([]*entities.Task, error) {
	tasks := make([]*entities.Task, 0, len(m.tasks))
	for _, task := range m.tasks {
		tasks = append(tasks, task)
	}
	return tasks, nil
}

func (m *mockRepository) Get(hash string) (*entities.Task, error) {
	if task, exists := m.tasks[hash]; exists {
		return task, nil
	}
	return nil, errors.New("task not found")
}

func (m *mockRepository) Add(schema schemas.TaskCreateSchema) (*entities.Task, error) {
	if m.createError != nil {
		return nil, m.createError
	}

	task := &entities.Task{
		ID:        "test-hash",
		Name:      "Test Task",
		Hash:      "test-hash",
		Category:  schema.Category,
		Path:      schema.Directory,
		State:     "DOWNLOADING",
		MagnetURI: schema.MagnetURI,
	}

	m.tasks[task.Hash] = task
	return task, nil
}

func (m *mockRepository) Stop(hash string) error {
	if m.stopError != nil {
		return m.stopError
	}
	if task, exists := m.tasks[hash]; exists {
		task.State = "PAUSED_DOWNLOAD"
		return nil
	}
	return errors.New("task not found")
}

func (m *mockRepository) Start(hash string) error {
	if m.startError != nil {
		return m.startError
	}
	if task, exists := m.tasks[hash]; exists {
		task.State = "DOWNLOADING"
		return nil
	}
	return errors.New("task not found")
}

func (m *mockRepository) ForceResume(hash string) error {
	if m.forceError != nil {
		return m.forceError
	}
	if task, exists := m.tasks[hash]; exists {
		task.State = "FORCED_DOWNLOAD"
		return nil
	}
	return errors.New("task not found")
}

func (m *mockRepository) Delete(id string, deleteFiles bool) error {
	if m.deleteError != nil {
		return m.deleteError
	}
	if _, exists := m.tasks[id]; exists {
		delete(m.tasks, id)
		return nil
	}
	return errors.New("task not found")
}

func (m *mockRepository) SetTags(hash string, tags []string) error {
	if task, exists := m.tasks[hash]; exists {
		task.Tags = tags
		return nil
	}
	return errors.New("task not found")
}

func (m *mockRepository) SetShareLimit(schema schemas.TaskSetShareLimitSchema) error {
	if _, exists := m.tasks[schema.Hash]; exists {
		// Simulate setting share limit (in real implementation, this would be handled by qBittorrent)
		return nil
	}
	return errors.New("task not found")
}

func (m *mockRepository) SetLocation(hash string, schema schemas.TaskSetLocationSchema) error {
	if task, exists := m.tasks[hash]; exists {
		task.Path = schema.Location
		return nil
	}
	return errors.New("task not found")
}

func (m *mockRepository) Rename(hash string, schema schemas.TaskRenameSchema) error {
	if task, exists := m.tasks[hash]; exists {
		task.Name = schema.NewName
		return nil
	}
	return errors.New("task not found")
}

func (m *mockRepository) SetSuperSeeding(hash string, schema schemas.TaskSuperSeedingSchema) error {
	if _, exists := m.tasks[hash]; exists {
		// Simulate setting super seeding mode (in real implementation, this would be handled by qBittorrent)
		return nil
	}
	return errors.New("task not found")
}

func (m *mockRepository) ForceRecheck(hash string) error {
	if _, exists := m.tasks[hash]; exists {
		// Simulate force recheck (in real implementation, this would be handled by qBittorrent)
		return nil
	}
	return errors.New("task not found")
}

func (m *mockRepository) ForceReannounce(hash string) error {
	if _, exists := m.tasks[hash]; exists {
		// Simulate force reannounce (in real implementation, this would be handled by qBittorrent)
		return nil
	}
	return errors.New("task not found")
}

func (m *mockRepository) SetDownloadLimit(hash string, schema schemas.TaskSetDownloadLimitSchema) error {
	if _, exists := m.tasks[hash]; exists {
		// Simulate setting download limit (in real implementation, this would be handled by qBittorrent)
		return nil
	}
	return errors.New("task not found")
}

func (m *mockRepository) SetUploadLimit(hash string, schema schemas.TaskSetUploadLimitSchema) error {
	if _, exists := m.tasks[hash]; exists {
		// Simulate setting upload limit (in real implementation, this would be handled by qBittorrent)
		return nil
	}
	return errors.New("task not found")
}

func (m *mockRepository) ListFiles(hash string) ([]*entities.TaskFile, error) {
	if _, exists := m.tasks[hash]; exists {
		// Return mock files for testing
		return []*entities.TaskFile{
			{
				Name:         "file1.txt",
				Size:         1024,
				Progress:     0.5,
				Priority:     1,
				IsSeed:       false,
				PieceRange:   [2]int{0, 10},
				Availability: 1.0,
			},
			{
				Name:         "file2.txt",
				Size:         2048,
				Progress:     1.0,
				Priority:     1,
				IsSeed:       true,
				PieceRange:   [2]int{11, 20},
				Availability: 1.0,
			},
		}, nil
	}
	return nil, errors.New("task not found")
}

func TestService_StopTask(t *testing.T) {
	ctx := context.Background()
	mockRepo := newMockRepository()
	service := &service{repository: mockRepo}

	// Add a test task
	task := &entities.Task{
		ID:    "test-hash",
		Hash:  "test-hash",
		Name:  "Test Task",
		State: "DOWNLOADING",
	}
	mockRepo.tasks["test-hash"] = task

	// Test successful stop
	err := service.StopTask(ctx, "test-hash")
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	if task.State != "PAUSED_DOWNLOAD" {
		t.Errorf("Expected task state to be PAUSED_DOWNLOAD, got %s", task.State)
	}

	// Test stop with repository error
	mockRepo.stopError = errors.New("repository error")
	err = service.StopTask(ctx, "test-hash")
	if err == nil {
		t.Error("Expected error, got nil")
	}

	// Test stop with non-existent task
	mockRepo.stopError = nil
	err = service.StopTask(ctx, "non-existent-hash")
	if err == nil {
		t.Error("Expected error for non-existent task, got nil")
	}
}

func TestService_StartTask(t *testing.T) {
	ctx := context.Background()
	mockRepo := newMockRepository()
	service := &service{repository: mockRepo}

	// Add a test task
	task := &entities.Task{
		ID:    "test-hash",
		Hash:  "test-hash",
		Name:  "Test Task",
		State: "PAUSED_DOWNLOAD",
	}
	mockRepo.tasks["test-hash"] = task

	// Test successful start
	err := service.StartTask(ctx, "test-hash")
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	if task.State != "DOWNLOADING" {
		t.Errorf("Expected task state to be DOWNLOADING, got %s", task.State)
	}

	// Test start with repository error
	mockRepo.startError = errors.New("repository error")
	err = service.StartTask(ctx, "test-hash")
	if err == nil {
		t.Error("Expected error, got nil")
	}

	// Test start with non-existent task
	mockRepo.startError = nil
	err = service.StartTask(ctx, "non-existent-hash")
	if err == nil {
		t.Error("Expected error for non-existent task, got nil")
	}
}

func TestService_ForceResumeTask(t *testing.T) {
	ctx := context.Background()
	mockRepo := newMockRepository()
	service := &service{repository: mockRepo}

	// Add a test task
	task := &entities.Task{
		ID:    "test-hash",
		Hash:  "test-hash",
		Name:  "Test Task",
		State: "STALLED_DOWNLOAD",
	}
	mockRepo.tasks["test-hash"] = task

	// Test successful force resume
	err := service.ForceResumeTask(ctx, "test-hash")
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	if task.State != "FORCED_DOWNLOAD" {
		t.Errorf("Expected task state to be FORCED_DOWNLOAD, got %s", task.State)
	}

	// Test force resume with repository error
	mockRepo.forceError = errors.New("repository error")
	err = service.ForceResumeTask(ctx, "test-hash")
	if err == nil {
		t.Error("Expected error, got nil")
	}

	// Test force resume with non-existent task
	mockRepo.forceError = nil
	err = service.ForceResumeTask(ctx, "non-existent-hash")
	if err == nil {
		t.Error("Expected error for non-existent task, got nil")
	}
}

func TestService_ListTasks(t *testing.T) {
	ctx := context.Background()
	mockRepo := newMockRepository()
	service := &service{repository: mockRepo}

	// Test empty list
	tasks, err := service.ListTasks(ctx)
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
	if len(tasks) != 0 {
		t.Errorf("Expected 0 tasks, got %d", len(tasks))
	}

	// Add test tasks
	task1 := &entities.Task{ID: "hash1", Hash: "hash1", Name: "Task 1"}
	task2 := &entities.Task{ID: "hash2", Hash: "hash2", Name: "Task 2"}
	mockRepo.tasks["hash1"] = task1
	mockRepo.tasks["hash2"] = task2

	// Test list with tasks
	tasks, err = service.ListTasks(ctx)
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
	if len(tasks) != 2 {
		t.Errorf("Expected 2 tasks, got %d", len(tasks))
	}
}

func TestService_GetTask(t *testing.T) {
	ctx := context.Background()
	mockRepo := newMockRepository()
	service := &service{repository: mockRepo}

	// Add a test task
	task := &entities.Task{ID: "test-hash", Hash: "test-hash", Name: "Test Task"}
	mockRepo.tasks["test-hash"] = task

	// Test successful get
	retrieved, err := service.GetTask(ctx, "test-hash")
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
	if retrieved.ID != task.ID {
		t.Errorf("Expected task ID %s, got %s", task.ID, retrieved.ID)
	}

	// Test get with non-existent task
	_, err = service.GetTask(ctx, "non-existent-hash")
	if err == nil {
		t.Error("Expected error for non-existent task, got nil")
	}
}

func TestService_CreateTask(t *testing.T) {
	ctx := context.Background()
	mockRepo := newMockRepository()
	service := &service{repository: mockRepo}

	schema := schemas.TaskCreateSchema{
		MagnetURI: "magnet:?xt=urn:btih:test-hash",
		Category:  "test-category",
		Directory: "/test/path",
		Tags:      []string{"tag1", "tag2"},
	}

	// Test successful create
	task, err := service.CreateTask(ctx, schema)
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	if task == nil {
		t.Error("Expected task, got nil")
		return
	}

	if task.Category != schema.Category {
		t.Errorf("Expected category %s, got %s", schema.Category, task.Category)
	}

	// Test create with repository error
	mockRepo.createError = errors.New("repository error")
	_, err = service.CreateTask(ctx, schema)
	if err == nil {
		t.Error("Expected error, got nil")
	}
}

func TestService_DeleteTask(t *testing.T) {
	ctx := context.Background()
	mockRepo := newMockRepository()
	service := &service{repository: mockRepo}

	// Add a test task
	task := &entities.Task{ID: "test-hash", Hash: "test-hash", Name: "Test Task"}
	mockRepo.tasks["test-hash"] = task

	// Test successful delete
	err := service.DeleteTask(ctx, "test-hash", false)
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	// Verify task was deleted
	if _, exists := mockRepo.tasks["test-hash"]; exists {
		t.Error("Expected task to be deleted")
	}

	// Test delete with repository error
	mockRepo.deleteError = errors.New("repository error")
	err = service.DeleteTask(ctx, "test-hash", false)
	if err == nil {
		t.Error("Expected error, got nil")
	}
}

func TestService_SetTaskShareLimit(t *testing.T) {
	ctx := context.Background()
	mockRepo := newMockRepository()
	service := &service{repository: mockRepo}

	// Add a test task
	task := &entities.Task{ID: "test-hash", Hash: "test-hash", Name: "Test Task"}
	mockRepo.tasks["test-hash"] = task

	schema := schemas.TaskSetShareLimitSchema{
		Hash:             "test-hash",
		RatioLimit:       2.0,
		SeedingTimeLimit: 3600,
	}

	// Test successful share limit setting
	err := service.SetTaskShareLimit(ctx, schema)
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	// Test with non-existent task
	schema.Hash = "non-existent-hash"
	err = service.SetTaskShareLimit(ctx, schema)
	if err == nil {
		t.Error("Expected error for non-existent task, got nil")
	}
}

func TestService_SetTaskLocation(t *testing.T) {
	ctx := context.Background()
	mockRepo := newMockRepository()
	service := &service{repository: mockRepo}

	// Add a test task
	task := &entities.Task{ID: "test-hash", Hash: "test-hash", Name: "Test Task", Path: "/old/path"}
	mockRepo.tasks["test-hash"] = task

	schema := schemas.TaskSetLocationSchema{
		Location: "/new/path",
	}

	// Test successful location setting
	err := service.SetTaskLocation(ctx, "test-hash", schema)
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	// Verify the location was set
	if task.Path != "/new/path" {
		t.Errorf("Expected path /new/path, got %s", task.Path)
	}

	// Test with non-existent task
	err = service.SetTaskLocation(ctx, "non-existent-hash", schema)
	if err == nil {
		t.Error("Expected error for non-existent task, got nil")
	}
}

func TestService_RenameTask(t *testing.T) {
	ctx := context.Background()
	mockRepo := newMockRepository()
	service := &service{repository: mockRepo}

	// Add a test task
	task := &entities.Task{ID: "test-hash", Hash: "test-hash", Name: "Old Name"}
	mockRepo.tasks["test-hash"] = task

	schema := schemas.TaskRenameSchema{
		NewName: "New Name",
	}

	// Test successful rename
	err := service.RenameTask(ctx, "test-hash", schema)
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	// Verify the name was changed
	if task.Name != "New Name" {
		t.Errorf("Expected name 'New Name', got %s", task.Name)
	}

	// Test with non-existent task
	err = service.RenameTask(ctx, "non-existent-hash", schema)
	if err == nil {
		t.Error("Expected error for non-existent task, got nil")
	}
}

func TestService_SetTaskSuperSeeding(t *testing.T) {
	ctx := context.Background()
	mockRepo := newMockRepository()
	service := &service{repository: mockRepo}

	// Add a test task
	task := &entities.Task{ID: "test-hash", Hash: "test-hash", Name: "Test Task"}
	mockRepo.tasks["test-hash"] = task

	schema := schemas.TaskSuperSeedingSchema{
		Enabled: true,
	}

	// Test successful super seeding setting
	err := service.SetTaskSuperSeeding(ctx, "test-hash", schema)
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	// Test with non-existent task
	err = service.SetTaskSuperSeeding(ctx, "non-existent-hash", schema)
	if err == nil {
		t.Error("Expected error for non-existent task, got nil")
	}
}

func TestService_ForceRecheckTask(t *testing.T) {
	ctx := context.Background()
	mockRepo := newMockRepository()
	service := &service{repository: mockRepo}

	// Add a test task
	task := &entities.Task{ID: "test-hash", Hash: "test-hash", Name: "Test Task"}
	mockRepo.tasks["test-hash"] = task

	// Test successful force recheck
	err := service.ForceRecheckTask(ctx, "test-hash")
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	// Test with non-existent task
	err = service.ForceRecheckTask(ctx, "non-existent-hash")
	if err == nil {
		t.Error("Expected error for non-existent task, got nil")
	}
}

func TestService_ForceReannounceTask(t *testing.T) {
	ctx := context.Background()
	mockRepo := newMockRepository()
	service := &service{repository: mockRepo}

	// Add a test task
	task := &entities.Task{ID: "test-hash", Hash: "test-hash", Name: "Test Task"}
	mockRepo.tasks["test-hash"] = task

	// Test successful force reannounce
	err := service.ForceReannounceTask(ctx, "test-hash")
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	// Test with non-existent task
	err = service.ForceReannounceTask(ctx, "non-existent-hash")
	if err == nil {
		t.Error("Expected error for non-existent task, got nil")
	}
}

func TestService_SetTaskDownloadLimit(t *testing.T) {
	ctx := context.Background()
	mockRepo := newMockRepository()
	service := &service{repository: mockRepo}

	// Add a test task
	task := &entities.Task{ID: "test-hash", Hash: "test-hash", Name: "Test Task"}
	mockRepo.tasks["test-hash"] = task

	schema := schemas.TaskSetDownloadLimitSchema{
		Limit: 1024000, // 1 MB/s in bytes
	}

	// Test successful download limit setting
	err := service.SetTaskDownloadLimit(ctx, "test-hash", schema)
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	// Test with non-existent task
	err = service.SetTaskDownloadLimit(ctx, "non-existent-hash", schema)
	if err == nil {
		t.Error("Expected error for non-existent task, got nil")
	}
}

func TestService_SetTaskUploadLimit(t *testing.T) {
	ctx := context.Background()
	mockRepo := newMockRepository()
	service := &service{repository: mockRepo}

	// Add a test task
	task := &entities.Task{ID: "test-hash", Hash: "test-hash", Name: "Test Task"}
	mockRepo.tasks["test-hash"] = task

	schema := schemas.TaskSetUploadLimitSchema{
		Limit: 512000, // 512 KB/s in bytes
	}

	// Test successful upload limit setting
	err := service.SetTaskUploadLimit(ctx, "test-hash", schema)
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	// Test with non-existent task
	err = service.SetTaskUploadLimit(ctx, "non-existent-hash", schema)
	if err == nil {
		t.Error("Expected error for non-existent task, got nil")
	}
}

func TestService_ListTaskFiles(t *testing.T) {
	ctx := context.Background()
	mockRepo := newMockRepository()
	service := &service{repository: mockRepo}

	// Add a test task
	task := &entities.Task{ID: "test-hash", Hash: "test-hash", Name: "Test Task"}
	mockRepo.tasks["test-hash"] = task

	// Test successful list files
	files, err := service.ListTaskFiles(ctx, "test-hash")
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	if len(files) != 2 {
		t.Errorf("Expected 2 files, got %d", len(files))
	}

	// Verify first file
	if files[0].Name != "file1.txt" {
		t.Errorf("Expected file name 'file1.txt', got %s", files[0].Name)
	}
	if files[0].Size != 1024 {
		t.Errorf("Expected file size 1024, got %d", files[0].Size)
	}
	if files[0].Progress != 0.5 {
		t.Errorf("Expected progress 0.5, got %f", files[0].Progress)
	}
	if files[0].IsSeed {
		t.Error("Expected IsSeed to be false")
	}

	// Verify second file
	if files[1].Name != "file2.txt" {
		t.Errorf("Expected file name 'file2.txt', got %s", files[1].Name)
	}
	if files[1].Size != 2048 {
		t.Errorf("Expected file size 2048, got %d", files[1].Size)
	}
	if files[1].Progress != 1.0 {
		t.Errorf("Expected progress 1.0, got %f", files[1].Progress)
	}
	if !files[1].IsSeed {
		t.Error("Expected IsSeed to be true")
	}

	// Test with non-existent task
	_, err = service.ListTaskFiles(ctx, "non-existent-hash")
	if err == nil {
		t.Error("Expected error for non-existent task, got nil")
	}
}
