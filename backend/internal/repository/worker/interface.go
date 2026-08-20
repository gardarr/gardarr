package worker

import (
	"context"

	"github.com/google/uuid"
	"github.com/jfxdev/gardarr/internal/entities"
	"github.com/jfxdev/gardarr/internal/schemas"
	"github.com/jfxdev/go-qbt"
)

// RepositoryInterface defines the interface for worker repository operations
type RepositoryInterface interface {
	CreateWorker(ctx context.Context, worker entities.Worker) (*entities.Worker, error)
	ListWorkers() ([]*entities.Worker, error)
	GetWorkerByUUID(uid uuid.UUID) (*entities.Worker, error)
	UpdateWorker(ctx context.Context, uid uuid.UUID, updates map[string]interface{}) (*entities.Worker, error)
	DeleteWorker(uid uuid.UUID) error
	CheckWorkerAvailability(worker *entities.Worker) error
	GetInstance(worker *entities.Worker) (*entities.Instance, error)
	GetInstanceWithoutDecrypt(worker *entities.Worker) (*entities.Instance, error)
	GetWorkerPreferences(worker *entities.Worker) (*entities.InstancePreferences, error)
	ListWorkerTasks(worker *entities.Worker) ([]*entities.Task, error)
	CreateWorkerTask(worker *entities.Worker, schema schemas.TaskCreateSchema) (*entities.Task, error)
	CreateWorkerTaskFromFile(worker *entities.Worker, fileName string, fileData []byte, schema schemas.TaskCreateFromFileSchema) (*entities.Task, error)
	StopWorkerTask(worker *entities.Worker, taskID string) error
	StartWorkerTask(worker *entities.Worker, taskID string) error
	ForceDownloadWorkerTask(worker *entities.Worker, taskID string) error
	GetWorkerTask(worker *entities.Worker, taskID string) (*entities.Task, error)
	DeleteWorkerTask(worker *entities.Worker, taskID string, purge bool) error
	ForceResumeWorkerTask(worker *entities.Worker, taskID string) error
	SetWorkerTaskLocation(worker *entities.Worker, taskID string, schema schemas.TaskSetLocationSchema) error
	RenameWorkerTask(worker *entities.Worker, taskID string, schema schemas.TaskRenameSchema) error
	SetWorkerTaskSuperSeeding(worker *entities.Worker, taskID string, schema schemas.TaskSuperSeedingSchema) error
	ForceRecheckWorkerTask(worker *entities.Worker, taskID string) error
	ForceReannounceWorkerTask(worker *entities.Worker, taskID string) error
	SetWorkerTaskDownloadLimit(worker *entities.Worker, taskID string, schema schemas.TaskSetDownloadLimitSchema) error
	SetWorkerTaskUploadLimit(worker *entities.Worker, taskID string, schema schemas.TaskSetUploadLimitSchema) error
	SetWorkerTaskTags(worker *entities.Worker, taskID string, schema schemas.TaskSetTagsSchema) error
	AddWorkerTaskTags(worker *entities.Worker, taskID string, tags []string) error
	CreateWorkerTags(worker *entities.Worker, tags []string) error
	SetWorkerTaskCategory(worker *entities.Worker, taskID string, schema schemas.TaskSetCategorySchema) error
	ListWorkerTaskFiles(worker *entities.Worker, taskID string) ([]*entities.TaskFile, error)
	GetWorkerTasksStats(worker *entities.Worker) (*entities.TaskStats, error)
	GetWorkerVersion(worker *entities.Worker) (*entities.WorkerVersion, error)
	GetWorkerTaskLimits(worker *entities.Worker, taskID string) (*entities.TaskLimits, error)
	SetWorkerTaskShareLimit(worker *entities.Worker, taskID string, limits schemas.TaskSetShareLimitSchema) error
	SetWorkerGlobalSpeedLimits(worker *entities.Worker, schema schemas.InstanceSetSpeedLimitSchema) error
	SetWorkerGlobalActiveLimits(worker *entities.Worker, schema schemas.InstanceSetMaxActiveTorrentLimitsSchema) error
	GetWorkerLogs(worker *entities.Worker, normal, info, warning, critical bool, lastKnownID int) ([]*qbt.LogEntry, error)
}
