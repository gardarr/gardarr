package task

import (
	"context"
	"strings"

	"github.com/gardarr/gardarr/internal/entities"
	"github.com/gardarr/gardarr/internal/interfaces"
	repository "github.com/gardarr/gardarr/internal/repository/task/agent"
	"github.com/gardarr/gardarr/internal/schemas"
)

type service struct {
	repository repository.RepositoryInterface
}

func New() (interfaces.TaskService, error) {
	r, err := repository.New()
	if err != nil {
		return nil, err
	}

	return &service{
		repository: r,
	}, nil
}

func (s *service) ListTasks(ctx context.Context) ([]*entities.Task, error) {
	return s.repository.List()
}

func (s *service) GetTask(ctx context.Context, id string) (*entities.Task, error) {
	return s.repository.Get(id)
}

func (s *service) CreateTask(ctx context.Context, schema schemas.TaskCreateSchema) (*entities.Task, error) {
	if schema.Directory != "" {
		schema.Directory = "/data/downloads"
	}

	uri, err := repository.ParseMagnetLink(schema.MagnetURI)
	if err != nil {
		return nil, err
	}

	list, err := s.repository.List()
	if err != nil {
		return nil, err
	}

	for _, item := range list {
		if strings.EqualFold(item.MagnetLink.Hash, uri.Hash) {
			return item, nil
		}
	}

	return s.repository.Add(schema)
}

func (s *service) PauseTask(ctx context.Context, hash string) error {
	return s.repository.Pause(hash)
}

func (s *service) DeleteTask(ctx context.Context, id string, deleteFiles bool) error {
	return s.repository.Delete(id, deleteFiles)
}

func (s *service) ResumeTask(ctx context.Context, hash string) error {
	return s.repository.Resume(hash)
}

func (s *service) ForceResumeTask(ctx context.Context, hash string) error {
	return s.repository.ForceResume(hash)
}

func (s *service) SetTaskShareLimit(ctx context.Context, schema schemas.TaskSetShareLimitSchema) error {
	return s.repository.SetShareLimit(schema)
}

func (s *service) SetTaskLocation(ctx context.Context, hash string, schema schemas.TaskSetLocationSchema) error {
	return s.repository.SetLocation(hash, schema)
}

func (s *service) RenameTask(ctx context.Context, hash string, schema schemas.TaskRenameSchema) error {
	return s.repository.Rename(hash, schema)
}

func (s *service) SetTaskSuperSeeding(ctx context.Context, hash string, schema schemas.TaskSuperSeedingSchema) error {
	return s.repository.SetSuperSeeding(hash, schema)
}

func (s *service) ForceRecheckTask(ctx context.Context, hash string) error {
	return s.repository.ForceRecheck(hash)
}

func (s *service) ForceReannounceTask(ctx context.Context, hash string) error {
	return s.repository.ForceReannounce(hash)
}
