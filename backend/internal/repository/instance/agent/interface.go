package agent

import (
	"context"

	"github.com/jfxdev/gardarr/internal/entities"
	"github.com/jfxdev/go-qbt"
)

// RepositoryInterface defines the interface for instance repository operations
type RepositoryInterface interface {
	GetInstance() (*entities.Instance, error)
	GetPreferences(ctx context.Context) (*entities.InstancePreferences, error)
	Ping() error
	GetStatus() string
	GetConnectionStatus() *entities.ConnectionStatus
	RefreshConnectionStatus(ctx context.Context) *entities.ConnectionStatus
	SetDownloadSpeedLimit(limit int) error
	SetUploadSpeedLimit(limit int) error
	SetMaxActiveTorrentLimits(maxDownloads, maxUploads, maxTorrents, maxChecking int) error
	GetLogs(normal bool, info bool, warning bool, critical bool, lastKnownID int) ([]*qbt.LogEntry, error)
}
