package agent

import (
	"context"

	"github.com/gardarr/gardarr/internal/entities"
	"github.com/gardarr/gardarr/internal/interfaces"
	repository "github.com/gardarr/gardarr/internal/repository/instance/agent"
)

func New() (interfaces.InstanceService, error) {
	r, err := repository.New()
	if err != nil {
		return nil, err
	}
	return &service{
		repository: r,
	}, nil
}

type service struct {
	repository *repository.Repository
}

func (s *service) GetInstance(ctx context.Context) (*entities.Instance, error) {
	info, err := s.repository.GetInstance()
	if err != nil {
		return nil, err
	}

	return info, nil
}

func (s *service) Ping(ctx context.Context) error {
	return s.repository.Ping()
}
