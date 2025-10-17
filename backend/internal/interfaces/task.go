package interfaces

import (
	"context"

	"github.com/gardarr/gardarr/internal/entities"
	"github.com/gardarr/gardarr/internal/schemas"
)

type TaskService interface {
	ListTasks(context.Context) ([]*entities.Task, error)
	GetTask(context.Context, string) (*entities.Task, error)
	CreateTask(context.Context, schemas.TaskCreateSchema) (*entities.Task, error)
	DeleteTask(context.Context, string, bool) error
	PauseTask(context.Context, string) error
	ResumeTask(context.Context, string) error
	ForceResumeTask(context.Context, string) error
	SetTaskShareLimit(context.Context, schemas.TaskSetShareLimitSchema) error
	SetTaskLocation(context.Context, string, schemas.TaskSetLocationSchema) error
	RenameTask(context.Context, string, schemas.TaskRenameSchema) error
	SetTaskSuperSeeding(context.Context, string, schemas.TaskSuperSeedingSchema) error
	ForceRecheckTask(context.Context, string) error
	ForceReannounceTask(context.Context, string) error
}

type InstanceService interface {
	GetInstance(context.Context) (*entities.Instance, error)
	Ping(context.Context) error
	GetPreferences(context.Context) (*entities.InstancePreferences, error)
	SetDownloadSpeedLimit(context.Context, schemas.InstanceSetDownloadSpeedLimitSchema) error
	SetUploadSpeedLimit(context.Context, schemas.InstanceSetUploadSpeedLimitSchema) error
}
