package agent

import (
	"context"
	"errors"

	"github.com/jfxdev/gardarr/internal/entities"
	"github.com/jfxdev/gardarr/internal/interfaces"
	repository "github.com/jfxdev/gardarr/internal/repository/instance/agent"
	"github.com/jfxdev/gardarr/internal/schemas"
	"github.com/jfxdev/go-qbt"
)

func New(client *qbt.Client) interfaces.InstanceService {
	r := repository.New(client)
	return &service{
		repository: r,
	}
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

func (s *service) GetConnectionStatus(_ context.Context) *entities.ConnectionStatus {
	return s.repository.GetConnectionStatus()
}

func (s *service) Ping(ctx context.Context) error {
	return s.repository.Ping()
}

func (s *service) GetPreferences(ctx context.Context) (*entities.InstancePreferences, error) {
	return s.repository.GetPreferences(ctx)
}

func (s *service) SetSpeedLimit(ctx context.Context, schema schemas.InstanceSetSpeedLimitSchema) error {
	// Currently unused: kept to satisfy InstanceService and for future propagation to the repository/client.
	_ = ctx

	if schema.DownloadLimit < -1 {
		return errors.New("download limit must be greater than or equal to -1")
	}

	if schema.UploadLimit < -1 {
		return errors.New("upload limit must be greater than or equal to -1")
	}

	if err := s.repository.SetDownloadSpeedLimit(schema.DownloadLimit); err != nil {
		return err
	}

	if err := s.repository.SetUploadSpeedLimit(schema.UploadLimit); err != nil {
		return err
	}

	return nil
}

func (s *service) SetMaxActiveTorrentLimits(ctx context.Context, schema schemas.InstanceSetMaxActiveTorrentLimitsSchema) error {
	// Currently unused: kept to satisfy InstanceService and for future propagation to the repository/client.
	_ = ctx

	return s.repository.SetMaxActiveTorrentLimits(
		schema.MaxActiveDownloads,
		schema.MaxActiveUploads,
		schema.MaxActiveTorrents,
		schema.MaxActiveCheckingTorrents,
	)
}

func (s *service) GetLogs(ctx context.Context, normal bool, info bool, warning bool, critical bool, lastKnownID int) ([]*qbt.LogEntry, error) {
	return s.repository.GetLogs(normal, info, warning, critical, lastKnownID)
}
