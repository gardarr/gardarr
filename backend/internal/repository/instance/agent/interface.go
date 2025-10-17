package agent

import (
	"context"

	"github.com/gardarr/gardarr/internal/entities"
)

// RepositoryInterface defines the interface for instance repository operations
type RepositoryInterface interface {
	GetInstance() (*entities.Instance, error)
	GetPreferences(ctx context.Context) (*entities.InstancePreferences, error)
	Ping() error
	SetDownloadSpeedLimit(limit int) error
	SetUploadSpeedLimit(limit int) error
}
