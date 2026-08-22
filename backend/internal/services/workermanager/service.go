package workermanager

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"
	"sync"

	"github.com/google/uuid"
	"github.com/jfxdev/gardarr/internal/entities"
	"github.com/jfxdev/gardarr/internal/infra/database"
	workerrepository "github.com/jfxdev/gardarr/internal/repository/worker"
	"github.com/jfxdev/gardarr/internal/schemas"
	"github.com/jfxdev/gardarr/internal/services/crypto"
	"github.com/jfxdev/gardarr/internal/services/events"
	metadata "github.com/jfxdev/gardarr/internal/services/task_metadata"
	"github.com/jfxdev/gardarr/internal/services/workerhealth"
	"github.com/jfxdev/gardarr/pkg/logger"
	"github.com/jfxdev/go-qbt"
)

type Service struct {
	repository      workerrepository.RepositoryInterface
	metadataService *metadata.Service
	health          *workerhealth.Service
}

func NewService(db *database.Database, c *crypto.CryptoService, baseURL, uploadDir string, eventSvc *events.Service) (*Service, error) {
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
		health:          workerhealth.NewService(repository, eventSvc),
	}, nil
}

// StartHealthMonitor begins the background worker health probe loop. It
// stops when ctx is canceled. Callers that need worker status/instance data
// (ListWorkers, ListTasks) read from the cache this loop maintains instead
// of probing qBittorrent inline.
func (s *Service) StartHealthMonitor(ctx context.Context) {
	s.health.Start(ctx)
}

// HealthSnapshot returns a copy of the current worker health cache, keyed by
// worker UUID. Used to catch a newly connected websocket client up on
// current worker status without waiting for the next transition.
func (s *Service) HealthSnapshot() map[uuid.UUID]workerhealth.Health {
	return s.health.Snapshot()
}

// cachedHealthError builds the error reported for a worker that's skipped
// because its health is confirmed ERRORED. Falls back to ErrorCode, then a
// fixed message, so a health record with an empty Error string still yields
// a non-empty, useful error instead of an empty one.
func cachedHealthError(h workerhealth.Health) error {
	if h.Error != "" {
		return errors.New(h.Error)
	}
	if h.ErrorCode != "" {
		return errors.New(string(h.ErrorCode))
	}
	return errors.New("worker is offline")
}

// applyHealth copies a cached/refreshed health snapshot onto a worker entity
// for API responses.
func applyHealth(w *entities.Worker, h workerhealth.Health) {
	w.Status = h.Status
	w.Error = h.Error
	w.ErrorCode = h.ErrorCode
	w.Permanent = h.Permanent
	w.Instance = h.Instance
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

	// Seed the health cache with the connectivity check already performed
	// above, so the new worker reads as ACTIVE immediately instead of
	// sitting at PENDING until the next background probe tick.
	applyHealth(worker, s.health.Seed(worker.UUID, instance, nil))

	return worker, nil
}

// ListWorkers returns every registered worker with its current health
// (Status/Error/ErrorCode/Permanent/Instance) overlaid from the background
// health cache. Only a worker that has NEVER been probed at all (a true
// cache miss - not merely "not yet confirmed ERRORED", which stays PENDING
// under the flap-dampening threshold) is probed synchronously on the spot,
// as a cold-start fallback so it doesn't render as offline before its very
// first check. Once that first probe lands, this is always a pure cache
// read: subsequent confirmation (or not) of ERRORED is left entirely to the
// background monitor, so a run of requests during the still-unconfirmed
// window doesn't each pay their own read-timeout wait in turn.
func (s *Service) ListWorkers() ([]*entities.Worker, error) {
	workers, err := s.ListWorkersBasic()
	if err != nil {
		return nil, err
	}

	var wg sync.WaitGroup
	for _, worker := range workers {
		if h, ok := s.health.Get(worker.UUID); ok {
			applyHealth(worker, h)
			continue
		}

		wg.Add(1)
		go func(w *entities.Worker) {
			defer wg.Done()
			applyHealth(w, s.health.Refresh(w))
		}(worker)
	}
	wg.Wait()

	return workers, nil
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

	// Process each worker concurrently. A worker whose health is confirmed
	// ERRORED is skipped entirely instead of dialed - its cached error is
	// reported immediately rather than waiting up to WORKER_TIMEOUT_SECONDS
	// for the same outcome the health monitor already knows.
	for _, worker := range workers {
		if h, ok := s.health.Get(worker.UUID); ok && h.Status == entities.WorkerStatusErrored {
			resultChan <- workerResult{workerID: worker.UUID.String(), err: cachedHealthError(h)}
			continue
		}

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

// GetWorker returns a single worker with its current health overlaid from
// the background health cache - like ListWorkers, it no longer dials the
// worker directly on every call. Only a worker that has never been probed
// at all falls back to an on-demand probe (bounded by
// WORKER_HEALTH_READ_TIMEOUT, default 5s); once any probe has landed, even
// an unconfirmed one, this is a pure cache read - see ListWorkers for why
// that distinction matters.
func (s *Service) GetWorker(ctx context.Context, id string) (*entities.Worker, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}

	worker, err := s.fetchWorker(id)
	if err != nil {
		return nil, err
	}

	if h, ok := s.health.Get(worker.UUID); ok {
		applyHealth(worker, h)
		return worker, nil
	}

	applyHealth(worker, s.health.Refresh(worker))
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
	// or blocks the update that already landed in the database. Seed the
	// health cache with the result immediately - an explicit user-triggered
	// update shouldn't wait out the background probe's flap-dampening
	// threshold before reflecting a fixed (or newly broken) connection.
	instance, err := s.repository.GetInstance(worker)
	if err != nil {
		logger.Debug("worker update: connectivity check failed",
			"worker_id", worker.UUID.String(),
			"error", err.Error(),
		)
	}
	applyHealth(worker, s.health.Seed(worker.UUID, instance, err))

	return worker, nil
}

func (s *Service) DeleteWorker(ctx context.Context, id string) error {
	// Get the current worker first
	currentWorker, err := s.fetchWorker(id)
	if err != nil {
		return err
	}
	parsedID := currentWorker.UUID

	if err := s.repository.DeleteWorker(parsedID); err != nil {
		return err
	}

	s.health.Delete(parsedID)
	return nil
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
		hash := strings.TrimSpace(item.Hash)
		if hash == "" {
			continue
		}
		key := item.WorkerID + ":" + hash
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		hashesByWorker[item.WorkerID] = append(hashesByWorker[item.WorkerID], hash)
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

// fanOutAcrossWorkers runs op against every registered worker concurrently.
// A worker whose op fails is reported in the returned map (keyed by worker
// ID, logged with logMsg) rather than failing the whole call, so tag
// operations remain best-effort per worker: an unreachable worker doesn't
// block the ones that succeed. total is the number of workers op was
// attempted against, so a caller can tell "every worker failed" (len(failed)
// == total, total > 0) apart from "nothing to attempt" (total == 0) - the
// two mean different things for whether local bookkeeping should proceed.
func (s *Service) fanOutAcrossWorkers(ctx context.Context, logMsg string, op func(w *entities.Worker) error) (failed map[string]string, total int, err error) {
	workers, err := s.ListWorkersBasic()
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list workers: %w", err)
	}

	type workerOutcome struct {
		workerID string
		err      error
	}

	if err := ctx.Err(); err != nil {
		return nil, 0, err
	}

	// A worker whose health is confirmed ERRORED is skipped entirely instead
	// of dialed - same treatment as ListTasks, so a tag op (create/delete/
	// rename/merge) doesn't wait up to WORKER_TIMEOUT_SECONDS per offline
	// worker before reporting the failure everyone already knows about.
	resultChan := make(chan workerOutcome, len(workers))
	for _, worker := range workers {
		if h, ok := s.health.Get(worker.UUID); ok && h.Status == entities.WorkerStatusErrored {
			resultChan <- workerOutcome{workerID: worker.UUID.String(), err: cachedHealthError(h)}
			continue
		}

		go func(w *entities.Worker) {
			resultChan <- workerOutcome{workerID: w.UUID.String(), err: op(w)}
		}(worker)
	}

	failed = make(map[string]string)
	for range workers {
		select {
		case <-ctx.Done():
			return nil, 0, ctx.Err()
		case outcome := <-resultChan:
			if outcome.err != nil {
				failed[outcome.workerID] = outcome.err.Error()
				logger.Error(logMsg, "worker_id", outcome.workerID, "error", outcome.err.Error())
			}
		}
	}

	return failed, len(workers), nil
}

// CreateTagsAcrossWorkers creates tags on every registered worker's
// qBittorrent server, without attaching them to any torrent. The tag can
// still be persisted locally and synced to a failed worker on its next
// write.
func (s *Service) CreateTagsAcrossWorkers(ctx context.Context, tags []string) (failed map[string]string, total int, err error) {
	return s.fanOutAcrossWorkers(ctx, "create tags failed for worker", func(w *entities.Worker) error {
		return s.repository.CreateWorkerTags(w, tags)
	})
}

// DeleteTagAcrossWorkers deregisters a tag from every worker's qBittorrent
// server, detaching it from every torrent that carries it.
func (s *Service) DeleteTagAcrossWorkers(ctx context.Context, name string) (failed map[string]string, total int, err error) {
	return s.fanOutAcrossWorkers(ctx, "delete tag failed for worker", func(w *entities.Worker) error {
		return s.repository.DeleteWorkerTags(w, []string{name})
	})
}

// MergeTagsAcrossWorkers is rename's and merge's shared mechanic (rename
// is a merge with a single source): on every worker, every torrent
// currently holding one of sources gets target added (scoped-tag
// exclusivity still applies, same as any other tag write), then sources
// are deregistered from that worker - detaching them from any torrent
// that still carries them and removing the now-orphaned tag entry. Both
// steps are idempotent (adding a tag a torrent already has, or deleting
// one it doesn't, is a no-op), so retrying after a partial failure is
// safe. A worker whose add step fails is skipped for the delete step too,
// so sources isn't deregistered there before target is confirmed attached.
func (s *Service) MergeTagsAcrossWorkers(ctx context.Context, sources []string, target string) (failed map[string]string, total int, err error) {
	return s.fanOutAcrossWorkers(ctx, "merge tags failed for worker", func(w *entities.Worker) error {
		return s.mergeTagsOnWorker(w, sources, target)
	})
}

func (s *Service) mergeTagsOnWorker(worker *entities.Worker, sources []string, target string) error {
	tasks, err := s.repository.ListWorkerTasks(worker)
	if err != nil {
		return err
	}

	hashes := hashesWithAnyTag(tasks, sources)

	if len(hashes) > 0 {
		if err := s.repository.AddWorkerTaskTags(worker, strings.Join(hashes, "|"), []string{target}); err != nil {
			return err
		}
	}

	return s.repository.DeleteWorkerTags(worker, sources)
}

// hashesWithAnyTag returns the hash of every task carrying at least one of
// names.
func hashesWithAnyTag(tasks []*entities.Task, names []string) []string {
	nameSet := make(map[string]struct{}, len(names))
	for _, name := range names {
		nameSet[name] = struct{}{}
	}

	var hashes []string
	for _, task := range tasks {
		for _, tag := range task.Tags {
			if _, ok := nameSet[tag]; ok {
				hashes = append(hashes, task.Hash)
				break
			}
		}
	}

	return hashes
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
