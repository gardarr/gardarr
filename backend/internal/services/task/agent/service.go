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
	repository *repository.Repository
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
