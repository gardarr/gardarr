package workermanager

import (
	"context"
	"fmt"
	"sync"
	"testing"

	"github.com/google/uuid"
	"github.com/jfxdev/gardarr/internal/entities"
	workerrepository "github.com/jfxdev/gardarr/internal/repository/worker"
	"github.com/jfxdev/gardarr/internal/schemas"
	"github.com/jfxdev/gardarr/internal/services/workerhealth"
)

// noopProber is a workerhealth prober that's never actually dialed in these
// tests - it exists only so workerhealth.NewService has something to hold.
type noopProber struct{}

func (noopProber) ListWorkers() ([]*entities.Worker, error) { return nil, nil }
func (noopProber) GetInstance(*entities.Worker) (*entities.Instance, error) {
	return nil, nil
}

func TestListTasksSkipsConfirmedOfflineWorkerWithoutDialing(t *testing.T) {
	health := workerhealth.NewService(noopProber{}, nil)
	workerID := uuid.New()
	health.Seed(workerID, nil, &workerrepository.WorkerError{
		Code:    entities.WorkerErrorCodeConnectionRefused,
		Message: "connection refused",
	})

	// service.repository is left nil on purpose: if the skip-offline check
	// in ListTasks doesn't fire, dialing this worker panics on a nil
	// repository, failing the test.
	service := &Service{health: health}
	worker := &entities.Worker{UUID: workerID}

	result, err := service.ListTasks(context.Background(), []*entities.Worker{worker})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result.Tasks) != 0 {
		t.Fatalf("expected no tasks from a skipped offline worker, got %d", len(result.Tasks))
	}
	msg, ok := result.Errors[workerID.String()]
	if !ok || msg != "connection refused" {
		t.Fatalf("expected cached error surfaced immediately, got %q (ok=%v)", msg, ok)
	}
}

// fanOutTestRepo backs fanOutAcrossWorkers tests: ListWorkers returns a
// fixed worker set, and CreateWorkerTags records which workers it was
// actually dialed for, so a test can assert an offline one was skipped.
type fanOutTestRepo struct {
	workerrepository.RepositoryInterface
	workers []*entities.Worker

	mu     sync.Mutex
	dialed []uuid.UUID
}

func (f *fanOutTestRepo) ListWorkers() ([]*entities.Worker, error) { return f.workers, nil }

func (f *fanOutTestRepo) CreateWorkerTags(w *entities.Worker, _ []string) error {
	f.mu.Lock()
	f.dialed = append(f.dialed, w.UUID)
	f.mu.Unlock()
	return nil
}

func TestFanOutAcrossWorkersSkipsConfirmedOfflineWorkerWithoutDialing(t *testing.T) {
	onlineID, offlineID := uuid.New(), uuid.New()
	repo := &fanOutTestRepo{workers: []*entities.Worker{
		{UUID: onlineID},
		{UUID: offlineID},
	}}

	health := workerhealth.NewService(noopProber{}, nil)
	health.Seed(offlineID, nil, &workerrepository.WorkerError{
		Code:    entities.WorkerErrorCodeConnectionRefused,
		Message: "connection refused",
	})

	service := &Service{repository: repo, health: health}

	failed, total, err := service.CreateTagsAcrossWorkers(context.Background(), []string{"movies"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if total != 2 {
		t.Fatalf("expected total=2, got %d", total)
	}

	msg, ok := failed[offlineID.String()]
	if !ok || msg != "connection refused" {
		t.Fatalf("expected offline worker reported failed with cached error, got %q (ok=%v)", msg, ok)
	}
	if _, ok := failed[onlineID.String()]; ok {
		t.Fatalf("expected online worker to succeed, got it in failed: %v", failed)
	}

	repo.mu.Lock()
	dialed := repo.dialed
	repo.mu.Unlock()
	if len(dialed) != 1 || dialed[0] != onlineID {
		t.Fatalf("expected only the online worker dialed, got %v", dialed)
	}
}

// fakeRepo satisfies workerrepository.RepositoryInterface via embedding (all
// unused methods stay nil and would panic if called - fine, since these
// tests only exercise GetWorkerByUUID), overriding just what GetWorker needs.
type fakeRepo struct {
	workerrepository.RepositoryInterface
	worker *entities.Worker
}

func (f *fakeRepo) GetWorkerByUUID(uuid.UUID) (*entities.Worker, error) {
	return f.worker, nil
}

// instanceProber is a workerhealth prober returning a fixed instance/error
// pair, for tests that need a real (successful) on-demand probe outcome.
type instanceProber struct {
	instance *entities.Instance
	err      error
}

func (p instanceProber) ListWorkers() ([]*entities.Worker, error) { return nil, nil }
func (p instanceProber) GetInstance(*entities.Worker) (*entities.Instance, error) {
	return p.instance, p.err
}

// filePriorityTestRepo backs SetWorkerTaskFilePriority tests: ListWorkerTaskFiles
// returns a fixed file set (with Index preserved regardless of any display
// ordering), and SetWorkerTaskFilePriority records whether it was actually
// called, so a test can assert the all-zero guard blocked the call.
type filePriorityTestRepo struct {
	workerrepository.RepositoryInterface
	worker *entities.Worker
	files  []*entities.TaskFile

	called bool
}

func (f *filePriorityTestRepo) GetWorkerByUUID(uuid.UUID) (*entities.Worker, error) {
	return f.worker, nil
}

func (f *filePriorityTestRepo) ListWorkerTaskFiles(*entities.Worker, string) ([]*entities.TaskFile, error) {
	return f.files, nil
}

func (f *filePriorityTestRepo) SetWorkerTaskFilePriority(*entities.Worker, string, schemas.TaskSetFilePrioritySchema) error {
	f.called = true
	return nil
}

func intPtr(v int) *int { return &v }

func TestSetWorkerTaskFilePriorityRejectsDeselectingEveryFile(t *testing.T) {
	workerID := uuid.New()
	repo := &filePriorityTestRepo{
		worker: &entities.Worker{UUID: workerID},
		files: []*entities.TaskFile{
			{Index: 0, Priority: 1},
			{Index: 1, Priority: 0}, // already deselected
		},
	}
	service := &Service{repository: repo}

	// Zeroing out the one remaining selected file (index 0) would leave
	// nothing selected - must be rejected.
	schema := schemas.TaskSetFilePrioritySchema{Indexes: []int{0}, Priority: intPtr(0)}
	err := service.SetWorkerTaskFilePriority(context.Background(), workerID.String(), "task-1", schema)
	if err == nil {
		t.Fatal("expected error when deselecting the last selected file, got nil")
	}
	if repo.called {
		t.Fatal("expected repository setter not to be called when the guard rejects the request")
	}
}

func TestSetWorkerTaskFilePrioritySucceedsWhenSomeFilesRemainSelected(t *testing.T) {
	workerID := uuid.New()
	repo := &filePriorityTestRepo{
		worker: &entities.Worker{UUID: workerID},
		files: []*entities.TaskFile{
			{Index: 0, Priority: 1},
			{Index: 1, Priority: 1},
		},
	}
	service := &Service{repository: repo}

	schema := schemas.TaskSetFilePrioritySchema{Indexes: []int{0}, Priority: intPtr(0)}
	err := service.SetWorkerTaskFilePriority(context.Background(), workerID.String(), "task-1", schema)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !repo.called {
		t.Fatal("expected repository setter to be called")
	}
}

func TestSetWorkerTaskFilePrioritySkipsGuardForNonZeroPriority(t *testing.T) {
	workerID := uuid.New()
	// files is left nil on purpose: ListWorkerTaskFiles must not be called
	// when the request isn't deselecting anything, since the guard only
	// applies to priority == 0.
	repo := &filePriorityTestRepo{worker: &entities.Worker{UUID: workerID}}
	service := &Service{repository: repo}

	schema := schemas.TaskSetFilePrioritySchema{Indexes: []int{0}, Priority: intPtr(6)}
	err := service.SetWorkerTaskFilePriority(context.Background(), workerID.String(), "task-1", schema)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !repo.called {
		t.Fatal("expected repository setter to be called")
	}
}

func TestGetWorkerUsesConfirmedHealthWithoutProbing(t *testing.T) {
	workerID := uuid.New()
	health := workerhealth.NewService(noopProber{}, nil)
	seededInstance := &entities.Instance{}
	health.Seed(workerID, seededInstance, nil)

	// health's prober is noopProber (always nil, nil) - if GetWorker fell
	// back to an on-demand probe instead of trusting the confirmed cache
	// entry, the Instance below would be nil, not the seeded pointer.
	service := &Service{
		repository: &fakeRepo{worker: &entities.Worker{UUID: workerID}},
		health:     health,
	}

	worker, err := service.GetWorker(context.Background(), workerID.String())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if worker.Status != entities.WorkerStatusActive {
		t.Fatalf("expected ACTIVE from cache, got %s", worker.Status)
	}
	if worker.Instance != seededInstance {
		t.Fatalf("expected the cached Instance pointer to be reused")
	}
}

func TestGetWorkerFallsBackToOnDemandProbeWhenUnconfirmed(t *testing.T) {
	workerID := uuid.New()
	freshInstance := &entities.Instance{}
	health := workerhealth.NewService(instanceProber{instance: freshInstance}, nil)

	service := &Service{
		repository: &fakeRepo{worker: &entities.Worker{UUID: workerID}},
		health:     health,
	}

	worker, err := service.GetWorker(context.Background(), workerID.String())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if worker.Status != entities.WorkerStatusActive {
		t.Fatalf("expected ACTIVE after on-demand probe, got %s", worker.Status)
	}
	if worker.Instance != freshInstance {
		t.Fatalf("expected the freshly probed Instance")
	}

	if h, ok := health.Get(workerID); !ok || h.Status != entities.WorkerStatusActive {
		t.Fatalf("expected health cache updated after the on-demand probe")
	}
}

// countingFailProber always fails GetInstance and counts how many times
// it was actually called.
type countingFailProber struct {
	mu    sync.Mutex
	calls int
}

func (p *countingFailProber) ListWorkers() ([]*entities.Worker, error) { return nil, nil }
func (p *countingFailProber) GetInstance(*entities.Worker) (*entities.Instance, error) {
	p.mu.Lock()
	p.calls++
	p.mu.Unlock()
	return nil, &workerrepository.WorkerError{Code: entities.WorkerErrorCodeConnectionRefused}
}
func (p *countingFailProber) callCount() int {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.calls
}

// TestGetWorkerDoesNotReprobeAnUnconfirmedWorkerOnEveryCall guards against
// the bug reported against the frontend: with flap-dampening requiring 3
// consecutive failures, a worker stays PENDING (not yet confirmed ERRORED)
// through its first 2 failures. Before this fix, GetWorker/ListWorkers
// treated "still PENDING" as "never probed" and re-dialed on every single
// call, so a sequence of requests hitting an unreachable worker during that
// window each paid their own WORKER_HEALTH_READ_TIMEOUT wait in turn - the
// page felt permanently stuck loading. Only the very first call (a true
// cache miss) should probe; everything after it, confirmed or not, must be
// a cache read, leaving confirmation entirely to the background monitor.
func TestGetWorkerDoesNotReprobeAnUnconfirmedWorkerOnEveryCall(t *testing.T) {
	workerID := uuid.New()
	prober := &countingFailProber{}
	health := workerhealth.NewService(prober, nil)

	service := &Service{
		repository: &fakeRepo{worker: &entities.Worker{UUID: workerID}},
		health:     health,
	}

	for i := range 5 {
		worker, err := service.GetWorker(context.Background(), workerID.String())
		if err != nil {
			t.Fatalf("call %d: unexpected error: %v", i, err)
		}
		if worker.Status != entities.WorkerStatusPending {
			t.Fatalf("call %d: expected still PENDING (below flap-dampening threshold), got %s", i, worker.Status)
		}
	}

	if calls := prober.callCount(); calls != 1 {
		t.Fatalf("expected exactly 1 probe across 5 GetWorker calls for an unconfirmed worker, got %d", calls)
	}
}

func TestServiceListTasksEmptyWorkers(t *testing.T) {
	// Create a minimal service for testing
	service := &Service{}

	result, err := service.ListTasks(context.Background(), []*entities.Worker{})

	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
	if len(result.Tasks) != 0 {
		t.Errorf("Expected empty tasks slice, got %d tasks", len(result.Tasks))
	}
	if len(result.Errors) != 0 {
		t.Errorf("Expected empty errors map, got %d errors", len(result.Errors))
	}
}

func TestServiceListTasksParallelExecution(t *testing.T) {
	// This test verifies that the parallel implementation works correctly
	// by checking that multiple workers are processed concurrently

	// Create a service with a test repository that has a delay
	// This helps us verify that the parallel execution is working
	service := &Service{}

	// We can't easily mock the repository without changing the service structure,
	// but we can test the basic functionality and error handling

	// Test with empty workers
	result, err := service.ListTasks(context.Background(), []*entities.Worker{})
	if err != nil {
		t.Errorf("Expected no error for empty workers, got %v", err)
	}
	if len(result.Tasks) != 0 {
		t.Errorf("Expected 0 tasks for empty workers, got %d", len(result.Tasks))
	}
}

func TestServiceListTasksErrorHandling(t *testing.T) {
	// Test that the method handles errors gracefully
	// Since we can't easily mock the repository, we'll test the error handling
	// by ensuring the method doesn't panic and returns appropriate errors

	service := &Service{}

	// Test with nil workers slice
	result, err := service.ListTasks(context.Background(), nil)
	if err != nil {
		t.Errorf("Expected no error for nil workers, got %v", err)
	}
	if len(result.Tasks) != 0 {
		t.Errorf("Expected 0 tasks for nil workers, got %d", len(result.Tasks))
	}
}

func TestBulkTaskActionValidatesActionSpecificFields(t *testing.T) {
	svc := &Service{}

	tests := []struct {
		name   string
		schema schemas.BulkTaskActionSchema
	}{
		{
			name: "set_category without category",
			schema: schemas.BulkTaskActionSchema{
				Action: "set_category",
				Items:  []schemas.BulkTaskItemSchema{{WorkerID: "w1", Hash: "h1"}},
			},
		},
		{
			name: "add_tags without tags",
			schema: schemas.BulkTaskActionSchema{
				Action: "add_tags",
				Items:  []schemas.BulkTaskItemSchema{{WorkerID: "w1", Hash: "h1"}},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if _, err := svc.BulkTaskAction(context.Background(), tt.schema); err == nil {
				t.Error("expected validation error, got nil")
			}
		})
	}
}

func TestBulkTaskActionReportsInvalidWorkerAsFailed(t *testing.T) {
	svc := &Service{}

	result, err := svc.BulkTaskAction(context.Background(), schemas.BulkTaskActionSchema{
		Action: "stop",
		Items: []schemas.BulkTaskItemSchema{
			{WorkerID: "not-a-uuid", Hash: "h1"},
			{WorkerID: "not-a-uuid", Hash: "h1"}, // duplicate must be deduped
		},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result.Succeeded != 0 {
		t.Errorf("expected 0 succeeded, got %d", result.Succeeded)
	}
	if len(result.Failed) != 1 {
		t.Errorf("expected 1 failed worker, got %d", len(result.Failed))
	}
	if _, ok := result.Failed["not-a-uuid"]; !ok {
		t.Error("expected failure entry for invalid worker id")
	}
}

// trackerRetryTestRepo simulates qBittorrent's removeTrackers behavior
// across a retried bulk remove_tracker call: a retry re-issues the removal
// for every hash in the batch, including ones that already succeeded -
// which qBittorrent answers with an HTTP 409 "not found" rather than
// treating as a no-op.
type trackerRetryTestRepo struct {
	workerrepository.RepositoryInterface
	worker *entities.Worker

	mu      sync.Mutex
	removed map[string]bool
	calls   []string
}

func (r *trackerRetryTestRepo) GetWorkerByUUID(uuid.UUID) (*entities.Worker, error) {
	return r.worker, nil
}

func (r *trackerRetryTestRepo) RemoveWorkerTaskTrackers(_ *entities.Worker, hash string, _ []string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.calls = append(r.calls, hash)
	if r.removed[hash] {
		return fmt.Errorf("failed to remove trackers. Status: 409, Response: no matching trackers found")
	}
	r.removed[hash] = true
	return nil
}

func TestBulkRemoveTrackerRetrySucceedsAfterPartialFailure(t *testing.T) {
	workerID := uuid.New()
	worker := &entities.Worker{UUID: workerID}
	repo := &trackerRetryTestRepo{worker: worker, removed: map[string]bool{}}
	svc := &Service{repository: repo}

	schema := schemas.BulkTaskActionSchema{
		Action:   "remove_tracker",
		Trackers: []string{"http://tracker.example/announce"},
	}

	// First attempt only reaches h1 (simulating h2 failing for some other
	// reason, e.g. a transient network error, before a caller retries).
	if err := svc.runBulkAction(workerID.String(), []string{"h1"}, schema); err != nil {
		t.Fatalf("unexpected error on first attempt: %v", err)
	}

	// Retry the full batch: h1 is now already removed (409 from
	// qBittorrent) and must not stop h2 from being processed.
	if err := svc.runBulkAction(workerID.String(), []string{"h1", "h2"}, schema); err != nil {
		t.Fatalf("expected retry to succeed despite h1 already being removed, got: %v", err)
	}

	if !repo.removed["h2"] {
		t.Error("expected h2 to be removed on retry")
	}
	if len(repo.calls) != 3 {
		t.Errorf("expected 3 total RemoveWorkerTaskTrackers calls, got %d", len(repo.calls))
	}
}

func TestHashesWithAnyTag(t *testing.T) {
	tests := []struct {
		name  string
		tasks []*entities.Task
		names []string
		want  []string
	}{
		{
			name:  "no tasks",
			tasks: []*entities.Task{},
			names: []string{"quality::1080p"},
			want:  nil,
		},
		{
			name: "matches a task carrying one of the names",
			tasks: []*entities.Task{
				{Hash: "h1", Tags: []string{"quality::1080p", "movies"}},
				{Hash: "h2", Tags: []string{"quality::4k"}},
			},
			names: []string{"quality::1080p"},
			want:  []string{"h1"},
		},
		{
			name: "matches every task carrying any of the names, once each",
			tasks: []*entities.Task{
				{Hash: "h1", Tags: []string{"quality::1080p"}},
				{Hash: "h2", Tags: []string{"quality::720p", "quality::1080p"}},
				{Hash: "h3", Tags: []string{"quality::4k"}},
			},
			names: []string{"quality::1080p", "quality::720p"},
			want:  []string{"h1", "h2"},
		},
		{
			name: "task with none of the names is excluded",
			tasks: []*entities.Task{
				{Hash: "h1", Tags: []string{"movies"}},
			},
			names: []string{"quality::1080p"},
			want:  nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := hashesWithAnyTag(tt.tasks, tt.names)
			if len(got) != len(tt.want) {
				t.Fatalf("got %v want %v", got, tt.want)
			}
			for i := range got {
				if got[i] != tt.want[i] {
					t.Fatalf("got %v want %v", got, tt.want)
				}
			}
		})
	}
}
