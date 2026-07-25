package workermanager

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"

	"github.com/jfxdev/gardarr/internal/entities"
	"github.com/jfxdev/gardarr/internal/infra/database"
	workerrepository "github.com/jfxdev/gardarr/internal/repository/worker"
	"github.com/jfxdev/gardarr/internal/schemas"
	"github.com/jfxdev/gardarr/internal/services/crypto"
	metadata "github.com/jfxdev/gardarr/internal/services/task_metadata"
	"github.com/jfxdev/gardarr/pkg/logger"
	"github.com/jfxdev/go-qbt"
)

type Service struct {
	repository      workerrepository.RepositoryInterface
	metadataService *metadata.Service
}

func NewService(db *database.Database, c *crypto.CryptoService, baseURL, uploadDir string) (*Service, error) {
	repository, err := workerrepository.NewRepository(db, c)
	if err != nil {
		return nil, err
	}

	meta, err := metadata.NewService(db, baseURL, uploadDir, nil)
	if err != nil {
		return nil, err
	}

	return &Service{
		repository:      repository,
		metadataService: meta,
	}, nil
}

// extractWorkerError extracts error code and permanent flag from an error.
// Returns WorkerErrorCodeUnknown and false if the error is not a WorkerError.
// Supports wrapped errors using errors.As.
func extractWorkerError(err error) (entities.WorkerErrorCode, bool) {
	var workerErr *workerrepository.WorkerError
	if errors.As(err, &workerErr) {
		return workerErr.Code, workerErr.Permanent
	}
	return entities.WorkerErrorCodeUnknown, false
}

func (s *Service) CreateWorker(ctx context.Context, schema *schemas.WorkerCreateSchema) (*entities.Worker, error) {
	input := entities.Worker{
		Name:                schema.Name,
		Type:                schema.Type,
		Address:             schema.URL,
		QBittorrentURL:      schema.URL,
		QBittorrentUsername: schema.Username,
		QBittorrentPassword: schema.Password,
		Icon:                schema.Icon,
		Color:               schema.Color,
	}

	// Validate instance connectivity BEFORE persisting to database
	instance, err := s.repository.GetInstanceWithoutDecrypt(&input)
	if err != nil {
		return nil, fmt.Errorf("não foi possível conectar com a instância: %s", err.Error())
	}

	// If connection is successful, create the worker
	worker, err := s.repository.CreateWorker(ctx, input)
	if err != nil {
		return nil, err
	}

	// Set status and instance data
	worker.Status = entities.WorkerStatusActive
	worker.Instance = instance

	return worker, nil
}

func (s *Service) ListWorkers() ([]*entities.Worker, error) {
	workers, err := s.repository.ListWorkers()
	if err != nil {
		return nil, err
	}

	// Create a channel to receive processed workers
	workerChan := make(chan *entities.Worker, len(workers))

	// Process each worker concurrently
	for _, worker := range workers {
		go func(w *entities.Worker) {
			w.Status = entities.WorkerStatusActive

			// Try to get instance
			// GetInstance internally calls isAvailable first - if that fails, it aborts and returns error
			// If error occurs (including isAvailable failure), abort and return worker with error status
			instance, err := s.repository.GetInstance(w)
			if err != nil {
				// isAvailable failed or GetInstance failed - abort execution
				w.ErrorCode, w.Permanent = extractWorkerError(err)
				w.Instance = nil
				w.Error = err.Error()

				if w.ErrorCode == entities.WorkerErrorCodeServiceUnavailable && strings.Contains(strings.ToLower(w.Error), "starting up") {
					w.Status = entities.WorkerStatusInitializing
				} else {
					w.Status = entities.WorkerStatusErrored
				}

				logger.Error("failed to get worker instance during list",
					"worker", w.Name,
					"error", err.Error(),
					"code", w.ErrorCode,
				)

				workerChan <- w
				return
			}

			// Success - set instance and clear any previous errors
			w.Instance = instance
			w.ErrorCode = entities.WorkerErrorCodeNone
			w.Permanent = false

			// Send the processed worker to the channel
			workerChan <- w
		}(worker)
	}

	// Collect all processed workers from the channel
	result := make([]*entities.Worker, 0, len(workers))
	for range len(workers) {
		processedWorker := <-workerChan
		result = append(result, processedWorker)
	}

	// Close the channel
	close(workerChan)

	return result, nil
}

// ListWorkersBasic returns workers straight from the database, with no live
// qBittorrent connectivity/instance check. Used by the /workers page for a
// fast initial render and by background loops (event poller, websocket hub
// stats) whose per-worker calls already fail cleanly on unreachable workers;
// callers that need real status (Torrents page, worker-select dropdowns,
// metrics) must keep using ListWorkers.
func (s *Service) ListWorkersBasic() ([]*entities.Worker, error) {
	workers, err := s.repository.ListWorkers()
	if err != nil {
		return nil, err
	}

	for _, worker := range workers {
		worker.Status = entities.WorkerStatusPending
		worker.Instance = nil
		worker.Error = ""
		worker.ErrorCode = entities.WorkerErrorCodeNone
		worker.Permanent = false
	}

	return workers, nil
}

// enrichTasksWithMetadata loads metadata for a list of tasks
func (s *Service) enrichTasksWithMetadata(ctx context.Context, tasks []*entities.Task) error {
	if len(tasks) == 0 {
		return nil
	}

	// Collect all task hashes
	taskHashes := make([]string, 0, len(tasks))
	for _, task := range tasks {
		taskHashes = append(taskHashes, task.Hash)
	}

	// Load metadata in batch
	metadataMap, err := s.metadataService.GetByTaskHashes(ctx, taskHashes)
	if err != nil {
		// Log error but don't fail - metadata is optional
		return nil
	}

	// Attach metadata to tasks
	for _, task := range tasks {
		if metadata, exists := metadataMap[task.Hash]; exists {
			task.Metadata = metadata
		}
	}

	return nil
}

func (s *Service) ListTasks(ctx context.Context, workers []*entities.Worker) (*entities.TaskListResult, error) {
	if len(workers) == 0 {
		return &entities.TaskListResult{
			Tasks:  []*entities.Task{},
			Errors: make(map[string]string),
		}, nil
	}

	type workerResult struct {
		workerID string
		tasks    []*entities.Task
		err      error
	}

	// Create channel to receive results
	resultChan := make(chan workerResult, len(workers))

	// Process each worker concurrently
	for _, worker := range workers {
		go func(w *entities.Worker) {
			// Check context before starting work
			select {
			case <-ctx.Done():
				resultChan <- workerResult{
					workerID: w.UUID.String(),
					err:      ctx.Err(),
				}
				return
			default:
			}

			tasks, err := s.repository.ListWorkerTasks(w)
			for _, task := range tasks {
				task.WorkerID = w.UUID
			}
			resultChan <- workerResult{
				workerID: w.UUID.String(),
				tasks:    tasks,
				err:      err,
			}
		}(worker)
	}

	// Collect results
	allTasks := make([]*entities.Task, 0)
	workerErrors := make(map[string]string)

	for i := 0; i < len(workers); i++ {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case res := <-resultChan:
			if res.err != nil {
				workerErrors[res.workerID] = res.err.Error()
			} else if res.tasks != nil {
				allTasks = append(allTasks, res.tasks...)
			}
		}
	}

	close(resultChan)

	// Enrich tasks with metadata
	_ = s.enrichTasksWithMetadata(ctx, allTasks)

	return &entities.TaskListResult{
		Tasks:  allTasks,
		Errors: workerErrors,
	}, nil
}

func (s *Service) GetWorker(ctx context.Context, id string) (*entities.Worker, error) {
	// Check if context is already cancelled
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}

	worker, err := s.fetchWorker(id)
	if err != nil {
		return nil, err
	}

	// Set default status to ACTIVE
	worker.Status = entities.WorkerStatusActive

	// GetInstance internally calls isAvailable (CheckWorkerAvailability) first.
	// No need for a separate CheckWorkerAvailability call — that would double
	// the HTTP round-trips to the worker per request.
	instance, err := s.repository.GetInstance(worker)
	if err != nil {
		// Check if context was cancelled during the call
		select {
		case <-ctx.Done():
			// Context was cancelled - abort execution
			worker.Status = entities.WorkerStatusErrored
			worker.Instance = nil
			worker.Error = "request cancelled or timeout"
			worker.ErrorCode = entities.WorkerErrorCodeTimeout
			worker.Permanent = false
			return worker, nil
		default:
			// Error from GetInstance (could be from isAvailable or instance fetch)
			// Abort execution and return worker with error status and instance = nil
			worker.Instance = nil
			worker.Error = err.Error()
			worker.ErrorCode, worker.Permanent = extractWorkerError(err)

			if worker.ErrorCode == entities.WorkerErrorCodeServiceUnavailable && strings.Contains(strings.ToLower(worker.Error), "starting up") {
				worker.Status = entities.WorkerStatusInitializing
			} else {
				worker.Status = entities.WorkerStatusErrored
			}
			return worker, nil
		}
	}

	// Success - set instance and clear any previous errors
	worker.Instance = instance
	worker.ErrorCode = entities.WorkerErrorCodeNone
	worker.Permanent = false

	return worker, nil
}

func (s *Service) UpdateWorker(ctx context.Context, id string, schema *schemas.WorkerUpdateSchema) (*entities.Worker, error) {
	// Get the current worker first
	currentWorker, err := s.fetchWorker(id)
	if err != nil {
		return nil, err
	}
	parsedID := currentWorker.UUID

	// Convert schema to map for updates
	updates := make(map[string]interface{})
	if schema.Name != "" {
		updates["name"] = schema.Name
	}
	if schema.URL != "" {
		updates["url"] = schema.URL
	}
	if schema.Username != "" {
		updates["username"] = schema.Username
	}
	if schema.Password != "" {
		updates["password"] = schema.Password
	}
	if schema.Icon != "" {
		updates["icon"] = schema.Icon
	}
	if schema.Color != "" {
		updates["color"] = schema.Color
	}

	// Persist immediately - the update must not depend on the qBittorrent
	// instance being reachable (e.g. fixing a wrong URL/credentials for a
	// worker that is currently offline).
	worker, err := s.repository.UpdateWorker(ctx, parsedID, updates)
	if err != nil {
		return nil, fmt.Errorf("failed to update worker: %w", err)
	}

	// Best-effort connectivity check purely to populate the response status.
	// A failure here reflects the worker's reachability, it never rolls back
	// or blocks the update that already landed in the database.
	instance, err := s.repository.GetInstance(worker)
	if err != nil {
		worker.Instance = nil
		worker.Error = err.Error()
		worker.ErrorCode, worker.Permanent = extractWorkerError(err)
		worker.Status = entities.WorkerStatusErrored
		return worker, nil
	}

	worker.Status = entities.WorkerStatusActive
	worker.Instance = instance

	return worker, nil
}

func (s *Service) DeleteWorker(ctx context.Context, id string) error {
	// Get the current worker first
	currentWorker, err := s.fetchWorker(id)
	if err != nil {
		return err
	}
	parsedID := currentWorker.UUID

	return s.repository.DeleteWorker(parsedID)
}

func (s *Service) CreateWorkerTask(ctx context.Context, id string, schema schemas.TaskCreateSchema) (*entities.Task, error) {
	worker, err := s.fetchWorker(id)
	if err != nil {
		return nil, err
	}

	task, err := s.repository.CreateWorkerTask(worker, schema)
	if err != nil {
		return nil, fmt.Errorf("failed to create task: %w", err)
	}

	return task, nil
}

func (s *Service) CreateWorkerTaskFromFile(ctx context.Context, id string, fileName string, fileData []byte, schema schemas.TaskCreateFromFileSchema) (*entities.Task, error) {
	worker, err := s.fetchWorker(id)
	if err != nil {
		return nil, err
	}

	task, err := s.repository.CreateWorkerTaskFromFile(worker, fileName, fileData, schema)
	if err != nil {
		return nil, fmt.Errorf("failed to create task from file: %w", err)
	}

	return task, nil
}

func (s *Service) GetPreferences(ctx context.Context, worker *entities.Worker) (*entities.InstancePreferences, error) {
	preferences, err := s.repository.GetWorkerPreferences(worker)
	if err != nil {
		return nil, fmt.Errorf("failed to get preferences: %w", err)
	}

	return preferences, nil
}

func (s *Service) ListWorkerTasks(ctx context.Context, id string) ([]*entities.Task, error) {
	worker, err := s.fetchWorker(id)
	if err != nil {
		return nil, err
	}

	tasks, err := s.repository.ListWorkerTasks(worker)
	if err != nil {
		return nil, fmt.Errorf("failed to list tasks: %w", err)
	}
	for _, task := range tasks {
		task.WorkerID = worker.UUID
	}

	// Enrich tasks with metadata
	_ = s.enrichTasksWithMetadata(ctx, tasks)

	return tasks, nil
}

func (s *Service) ListWorkersTasks(ctx context.Context) (*entities.TaskListResult, error) {
	workers, err := s.repository.ListWorkers()
	if err != nil {
		return nil, fmt.Errorf("failed to list workers: %w", err)
	}

	return s.ListTasks(ctx, workers)
}

func (s *Service) StopWorkerTask(ctx context.Context, workerID, taskID string) error {
	worker, err := s.fetchWorker(workerID)
	if err != nil {
		return err
	}

	return s.repository.StopWorkerTask(worker, taskID)
}

func (s *Service) StartWorkerTask(ctx context.Context, workerID, taskID string) error {
	worker, err := s.fetchWorker(workerID)
	if err != nil {
		return err
	}

	return s.repository.StartWorkerTask(worker, taskID)
}

func (s *Service) ForceDownloadWorkerTask(ctx context.Context, workerID, taskID string) error {
	worker, err := s.fetchWorker(workerID)
	if err != nil {
		return err
	}

	return s.repository.ForceDownloadWorkerTask(worker, taskID)
}

func (s *Service) GetWorkerTask(ctx context.Context, workerID, taskID string) (*entities.Task, error) {
	worker, err := s.fetchWorker(workerID)
	if err != nil {
		return nil, err
	}

	task, err := s.repository.GetWorkerTask(worker, taskID)
	if err != nil {
		return nil, fmt.Errorf("failed to get task: %w", err)
	}

	// Enrich task with metadata
	_ = s.enrichTasksWithMetadata(ctx, []*entities.Task{task})

	return task, nil
}

func (s *Service) DeleteWorkerTask(ctx context.Context, workerID, taskID string, purge bool) error {
	worker, err := s.fetchWorker(workerID)
	if err != nil {
		return err
	}

	return s.repository.DeleteWorkerTask(worker, taskID, purge)
}

func (s *Service) ForceResumeWorkerTask(ctx context.Context, workerID, taskID string) error {
	worker, err := s.fetchWorker(workerID)
	if err != nil {
		return err
	}

	return s.repository.ForceResumeWorkerTask(worker, taskID)
}

func (s *Service) SetWorkerTaskShareLimit(ctx context.Context, workerID, taskID string, schema schemas.TaskSetShareLimitSchema) error {
	worker, err := s.fetchWorker(workerID)
	if err != nil {
		return err
	}

	return s.repository.SetWorkerTaskShareLimit(worker, taskID, schema)
}

func (s *Service) SetWorkerTaskLocation(ctx context.Context, workerID, taskID string, schema schemas.TaskSetLocationSchema) error {
	worker, err := s.fetchWorker(workerID)
	if err != nil {
		return err
	}

	return s.repository.SetWorkerTaskLocation(worker, taskID, schema)
}

func (s *Service) RenameWorkerTask(ctx context.Context, workerID, taskID string, schema schemas.TaskRenameSchema) error {
	worker, err := s.fetchWorker(workerID)
	if err != nil {
		return err
	}

	return s.repository.RenameWorkerTask(worker, taskID, schema)
}

func (s *Service) SetWorkerTaskSuperSeeding(ctx context.Context, workerID, taskID string, schema schemas.TaskSuperSeedingSchema) error {
	worker, err := s.fetchWorker(workerID)
	if err != nil {
		return err
	}

	return s.repository.SetWorkerTaskSuperSeeding(worker, taskID, schema)
}

func (s *Service) ForceRecheckWorkerTask(ctx context.Context, workerID, taskID string) error {
	worker, err := s.fetchWorker(workerID)
	if err != nil {
		return err
	}

	return s.repository.ForceRecheckWorkerTask(worker, taskID)
}

func (s *Service) ForceReannounceWorkerTask(ctx context.Context, workerID, taskID string) error {
	worker, err := s.fetchWorker(workerID)
	if err != nil {
		return err
	}

	return s.repository.ForceReannounceWorkerTask(worker, taskID)
}

func (s *Service) SetWorkerTaskDownloadLimit(ctx context.Context, workerID, taskID string, schema schemas.TaskSetDownloadLimitSchema) error {
	worker, err := s.fetchWorker(workerID)
	if err != nil {
		return err
	}

	return s.repository.SetWorkerTaskDownloadLimit(worker, taskID, schema)
}

func (s *Service) SetWorkerTaskUploadLimit(ctx context.Context, workerID, taskID string, schema schemas.TaskSetUploadLimitSchema) error {
	worker, err := s.fetchWorker(workerID)
	if err != nil {
		return err
	}

	return s.repository.SetWorkerTaskUploadLimit(worker, taskID, schema)
}

func (s *Service) ListWorkerTaskFiles(ctx context.Context, workerID, taskID string) ([]*entities.TaskFile, error) {
	worker, err := s.fetchWorker(workerID)
	if err != nil {
		return nil, err
	}

	files, err := s.repository.ListWorkerTaskFiles(worker, taskID)
	if err != nil {
		return nil, fmt.Errorf("failed to list task files: %w", err)
	}

	for _, file := range files {
		file.Progress = file.Progress * 100
	}

	// Sort files by size, greatest first
	sort.Slice(files, func(i, j int) bool {
		return files[i].Size > files[j].Size
	})

	return files, nil
}

func (s *Service) GetWorkerTasksStats(ctx context.Context, id string) (*entities.TaskStats, error) {
	worker, err := s.fetchWorker(id)
	if err != nil {
		return nil, err
	}

	// GetTasksStats already lists all tasks once and computes TotalTasksCount,
	// TotalDiskSize and WordCloud from them; listing again here would double
	// the /torrents/info load on the qBittorrent instance for no new data.
	stats, err := s.repository.GetWorkerTasksStats(worker)
	if err != nil {
		return nil, fmt.Errorf("failed to get tasks stats: %w", err)
	}

	return stats, nil
}

// BulkTaskAction applies one action to many tasks at once. Hashes are grouped
// per worker and sent to qBittorrent as a single batched call ("h1|h2|...",
// which its API supports natively), so N selected torrents cost one HTTP
// round trip per worker instead of N. Workers are processed in parallel;
// failures are reported per worker without aborting the others.
var validBulkTaskActions = map[string]struct{}{
	"stop":             {},
	"start":            {},
	"force_resume":     {},
	"force_recheck":    {},
	"force_reannounce": {},
	"set_category":     {},
	"add_tags":         {},
	"delete":           {},
}

// validateBulkTaskAction checks that schema.Action is a supported action and
// carries whatever extra fields that action requires.
func validateBulkTaskAction(schema schemas.BulkTaskActionSchema) error {
	switch schema.Action {
	case "set_category":
		if schema.Category == nil {
			return fmt.Errorf("category is required for set_category action")
		}
	case "add_tags":
		if len(schema.Tags) == 0 {
			return fmt.Errorf("tags are required for add_tags action")
		}
	default:
		if _, ok := validBulkTaskActions[schema.Action]; !ok {
			return fmt.Errorf("unsupported bulk action: %s", schema.Action)
		}
	}
	return nil
}

// groupBulkTaskHashesByWorker groups hashes per worker, deduplicated,
// preserving request order.
func groupBulkTaskHashesByWorker(items []schemas.BulkTaskItemSchema) map[string][]string {
	hashesByWorker := make(map[string][]string)
	seen := make(map[string]struct{}, len(items))
	for _, item := range items {
		key := item.WorkerID + ":" + item.Hash
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		hashesByWorker[item.WorkerID] = append(hashesByWorker[item.WorkerID], item.Hash)
	}
	return hashesByWorker
}

func (s *Service) BulkTaskAction(ctx context.Context, schema schemas.BulkTaskActionSchema) (*entities.BulkTaskActionResult, error) {
	if err := validateBulkTaskAction(schema); err != nil {
		return nil, err
	}

	hashesByWorker := groupBulkTaskHashesByWorker(schema.Items)

	type workerOutcome struct {
		workerID  string
		succeeded int
		err       error
	}

	resultChan := make(chan workerOutcome, len(hashesByWorker))
	for workerID, hashes := range hashesByWorker {
		go func(workerID string, hashes []string) {
			err := s.runBulkAction(workerID, hashes, schema)
			outcome := workerOutcome{workerID: workerID, err: err}
			if err == nil {
				outcome.succeeded = len(hashes)
			}
			resultChan <- outcome
		}(workerID, hashes)
	}

	result := &entities.BulkTaskActionResult{Failed: make(map[string]string)}
	for range len(hashesByWorker) {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case outcome := <-resultChan:
			if outcome.err != nil {
				result.Failed[outcome.workerID] = outcome.err.Error()
				logger.Error("bulk task action failed for worker",
					"worker_id", outcome.workerID,
					"action", schema.Action,
					"error", outcome.err.Error(),
				)
			} else {
				result.Succeeded += outcome.succeeded
			}
		}
	}

	return result, nil
}

// runBulkAction executes one action against a single worker with all its
// hashes joined into qBittorrent's native multi-hash form.
func (s *Service) runBulkAction(workerID string, hashes []string, schema schemas.BulkTaskActionSchema) error {
	worker, err := s.fetchWorker(workerID)
	if err != nil {
		return err
	}

	joined := strings.Join(hashes, "|")

	switch schema.Action {
	case "stop":
		return s.repository.StopWorkerTask(worker, joined)
	case "start":
		return s.repository.StartWorkerTask(worker, joined)
	case "force_resume":
		return s.repository.ForceResumeWorkerTask(worker, joined)
	case "force_recheck":
		return s.repository.ForceRecheckWorkerTask(worker, joined)
	case "force_reannounce":
		return s.repository.ForceReannounceWorkerTask(worker, joined)
	case "set_category":
		return s.repository.SetWorkerTaskCategory(worker, joined, schemas.TaskSetCategorySchema{Category: *schema.Category})
	case "add_tags":
		return s.repository.AddWorkerTaskTags(worker, joined, schema.Tags)
	case "delete":
		return s.repository.DeleteWorkerTask(worker, joined, schema.Purge)
	default:
		return fmt.Errorf("unsupported bulk action: %s", schema.Action)
	}
}

func (s *Service) GetWorkerVersion(ctx context.Context, id string) (*entities.WorkerVersion, error) {
	worker, err := s.fetchWorker(id)
	if err != nil {
		return nil, err
	}

	version, err := s.repository.GetWorkerVersion(worker)
	if err != nil {
		return nil, fmt.Errorf("failed to get worker version: %w", err)
	}

	return version, nil
}

func (s *Service) SetWorkerTaskTags(ctx context.Context, workerID, taskID string, schema schemas.TaskSetTagsSchema) error {
	worker, err := s.fetchWorker(workerID)
	if err != nil {
		return err
	}

	return s.repository.SetWorkerTaskTags(worker, taskID, schema)
}

func (s *Service) SetWorkerTaskCategory(ctx context.Context, workerID, taskID string, schema schemas.TaskSetCategorySchema) error {
	worker, err := s.fetchWorker(workerID)
	if err != nil {
		return err
	}

	return s.repository.SetWorkerTaskCategory(worker, taskID, schema)
}

func (s *Service) GetWorkerTaskLimits(ctx context.Context, worker *entities.Worker, taskID string) (*entities.TaskLimits, error) {
	return s.repository.GetWorkerTaskLimits(worker, taskID)
}

func (s *Service) SetWorkerGlobalSpeedLimits(ctx context.Context, worker *entities.Worker, schema schemas.InstanceSetSpeedLimitSchema) error {
	return s.repository.SetWorkerGlobalSpeedLimits(worker, schema)
}

func (s *Service) SetWorkerGlobalActiveLimits(ctx context.Context, worker *entities.Worker, schema schemas.InstanceSetMaxActiveTorrentLimitsSchema) error {
	return s.repository.SetWorkerGlobalActiveLimits(worker, schema)
}

func (s *Service) GetWorkerLogs(ctx context.Context, workerID string, normal, info, warning, critical bool, lastKnownID int) ([]*qbt.LogEntry, error) {
	worker, err := s.fetchWorker(workerID)
	if err != nil {
		return nil, err
	}

	return s.repository.GetWorkerLogs(worker, normal, info, warning, critical, lastKnownID)
}
