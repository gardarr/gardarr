package agent

import (
	"context"

	"github.com/jfxdev/gardarr/internal/entities"
	"github.com/jfxdev/gardarr/internal/interfaces"
	repository "github.com/jfxdev/gardarr/internal/repository/instance/agent"
	"github.com/jfxdev/gardarr/internal/schemas"
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
	repository repository.RepositoryInterface
}

func (s *service) GetInstance(ctx context.Context) (*entities.Instance, error) {
	info, err := s.repository.GetInstance()
	if err != nil {
		return nil, err
	}

	return info, nil
}

func (s *service) GetStatus(ctx context.Context) string {
	return s.repository.GetStatus()
}

func (s *service) Ping(ctx context.Context) error {
	return s.repository.Ping()
}

func (s *service) GetPreferences(ctx context.Context) (*entities.InstancePreferences, error) {
	return s.repository.GetPreferences(ctx)
}

func (s *service) SetDownloadSpeedLimit(ctx context.Context, schema schemas.InstanceSetDownloadSpeedLimitSchema) error {
	return s.repository.SetDownloadSpeedLimit(schema.Limit)
}

func (s *service) SetUploadSpeedLimit(ctx context.Context, schema schemas.InstanceSetUploadSpeedLimitSchema) error {
	return s.repository.SetUploadSpeedLimit(schema.Limit)
}
