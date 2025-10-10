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
}

type InstanceService interface {
	GetInstance(context.Context) (*entities.Instance, error)
	Ping(context.Context) error
}
