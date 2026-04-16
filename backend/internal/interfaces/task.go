package interfaces

import (
	"context"

	"github.com/jfxdev/gardarr/internal/entities"
	"github.com/jfxdev/gardarr/internal/schemas"
	"github.com/jfxdev/go-qbt"
)

type TaskService interface {
	ListTasks(context.Context) ([]*entities.Task, error)
	GetTask(context.Context, string) (*entities.Task, error)
	CreateTask(context.Context, schemas.TaskCreateSchema) (*entities.Task, error)
	DeleteTask(context.Context, string, bool) error
	StopTask(context.Context, string) error
	StartTask(context.Context, string) error
	ForceResumeTask(context.Context, string) error
	SetTaskLocation(context.Context, string, schemas.TaskSetLocationSchema) error
	RenameTask(context.Context, string, schemas.TaskRenameSchema) error
	SetTaskSuperSeeding(context.Context, string, schemas.TaskSuperSeedingSchema) error
	ForceRecheckTask(context.Context, string) error
	ForceReannounceTask(context.Context, string) error
	SetTaskDownloadLimit(context.Context, string, schemas.TaskSetDownloadLimitSchema) error
	SetTaskUploadLimit(context.Context, string, schemas.TaskSetUploadLimitSchema) error
	SetTaskTags(context.Context, string, schemas.TaskSetTagsSchema) error
	SetTaskCategory(context.Context, string, schemas.TaskSetCategorySchema) error
	ListTaskFiles(context.Context, string) ([]*entities.TaskFile, error)
	GetTasksStats(context.Context) (*entities.TaskStats, error)
	GetTaskLimits(context.Context, string) (*entities.TaskLimits, error)
	SetTaskShareLimit(context.Context, string, schemas.TaskSetShareLimitSchema) error
}

type InstanceService interface {
	GetInstance(context.Context) (*entities.Instance, error)
	GetStatus(context.Context) string
	GetConnectionStatus(context.Context) *entities.ConnectionStatus
	Ping(context.Context) error
	GetPreferences(context.Context) (*entities.InstancePreferences, error)
	SetSpeedLimit(context.Context, schemas.InstanceSetSpeedLimitSchema) error
	SetMaxActiveTorrentLimits(context.Context, schemas.InstanceSetMaxActiveTorrentLimitsSchema) error
	GetLogs(ctx context.Context, normal bool, info bool, warning bool, critical bool, lastKnownID int) ([]*qbt.LogEntry, error)
}

// TaskRepositoryInterface defines the interface for task repository operations
type TaskRepositoryInterface interface {
	List() ([]*entities.Task, error)
	Get(hash string) (*entities.Task, error)
	GetLimits(hash string) (*entities.TaskLimits, error)
	Add(schema schemas.TaskCreateSchema) (*entities.Task, error)
	Stop(hash string) error
	Start(hash string) error
	ForceResume(hash string) error
	Delete(id string, deleteFiles bool) error
	SetTags(hash string, tags []string) error
	SetCategory(hash string, category string) error
	SetShareLimit(hash string, limits entities.TaskShareLimit) error
	SetLocation(hash string, schema schemas.TaskSetLocationSchema) error
	Rename(hash string, schema schemas.TaskRenameSchema) error
	SetSuperSeeding(hash string, schema schemas.TaskSuperSeedingSchema) error
	ForceRecheck(hash string) error
	ForceReannounce(hash string) error
	SetDownloadLimit(hash string, schema schemas.TaskSetDownloadLimitSchema) error
	SetUploadLimit(hash string, schema schemas.TaskSetUploadLimitSchema) error
	ListFiles(hash string) ([]*entities.TaskFile, error)
}
