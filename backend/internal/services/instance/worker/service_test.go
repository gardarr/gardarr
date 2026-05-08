package worker

import (
	"context"
	"errors"
	"testing"

	"github.com/jfxdev/gardarr/internal/entities"
	"github.com/jfxdev/gardarr/internal/schemas"
	"github.com/jfxdev/go-qbt"
)

// mockInstanceRepository is a mock implementation of the instance repository for testing
type mockInstanceRepository struct {
	instance                  *entities.Instance
	preferences               *entities.InstancePreferences
	pingError                 error
	downloadError             error
	uploadError               error
	status                    string
	refreshedConnectionStatus *entities.ConnectionStatus
}

func newMockInstanceRepository() *mockInstanceRepository {
	return &mockInstanceRepository{
		instance: &entities.Instance{
			Application: entities.InstanceApplication{
				Version:    "v4.5.0",
				APIVersion: "2.0",
			},
			Server: entities.InstanceServer{
				FreeSpaceOnDisk: 1000000000,
			},
			Transfer: entities.InstanceTransfer{
				AllTimeDownloaded:     500000000,
				AllTimeUploaded:       300000000,
				GlobalRatio:           0.6,
				LastExternalAddressV4: "192.168.1.100",
				LastExternalAddressV6: "::1",
			},
		},
		preferences: &entities.InstancePreferences{
			GlobalRateLimits: entities.InstancePreferencesGlobalRateLimits{
				DownloadSpeedLimit: 1000000,
				UploadSpeedLimit:   500000,
			},
		},
	}
}

func (m *mockInstanceRepository) GetInstance() (*entities.Instance, error) {
	return m.instance, nil
}

func (m *mockInstanceRepository) GetStatus() string {
	return m.status
}

func (m *mockInstanceRepository) GetConnectionStatus() *entities.ConnectionStatus {
	status := m.status
	if status == "" {
		status = entities.ConnectionStatusConnected
	}
	return &entities.ConnectionStatus{
		Status:    status,
		ErrorCode: entities.WorkerErrorCodeNone,
		Message:   "",
		Permanent: false,
	}
}

func (m *mockInstanceRepository) GetPreferences(ctx context.Context) (*entities.InstancePreferences, error) {
	return m.preferences, nil
}

func (m *mockInstanceRepository) Ping() error {
	return m.pingError
}

func (m *mockInstanceRepository) SetDownloadSpeedLimit(limit int) error {
	if m.downloadError != nil {
		return m.downloadError
	}
	m.preferences.GlobalRateLimits.DownloadSpeedLimit = limit
	return nil
}

func (m *mockInstanceRepository) SetUploadSpeedLimit(limit int) error {
	if m.uploadError != nil {
		return m.uploadError
	}
	m.preferences.GlobalRateLimits.UploadSpeedLimit = limit
	return nil
}

func (m *mockInstanceRepository) SetMaxActiveTorrentLimits(maxDownloads, maxUploads, maxTorrents, maxChecking int) error {
	m.preferences.ActiveTorrentLimits.MaxActiveDownloads = maxDownloads
	m.preferences.ActiveTorrentLimits.MaxActiveUploads = maxUploads
	m.preferences.ActiveTorrentLimits.MaxActiveTorrents = maxTorrents
	m.preferences.ActiveTorrentLimits.MaxActiveCheckingTorrents = maxChecking
	return nil
}

func (m *mockInstanceRepository) RefreshConnectionStatus(ctx context.Context) *entities.ConnectionStatus {
	if m.refreshedConnectionStatus != nil {
		// Simulate the real repository: refresh updates the cached status.
		m.status = m.refreshedConnectionStatus.Status
		return m.refreshedConnectionStatus
	}
	return m.GetConnectionStatus()
}

func (m *mockInstanceRepository) GetLogs(normal, info, warning, critical bool, lastKnownID int) ([]*qbt.LogEntry, error) {
	return nil, nil
}

func TestServiceGetInstance(t *testing.T) {
	ctx := context.Background()
	mockRepo := newMockInstanceRepository()
	service := &service{repository: mockRepo}

	instance, err := service.GetInstance(ctx)
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	if instance == nil {
		t.Error("Expected instance, got nil")
		return
	}

	if instance.Application.Version != "v4.5.0" {
		t.Errorf("Expected version v4.5.0, got %s", instance.Application.Version)
	}
}

func TestServiceGetPreferences(t *testing.T) {
	ctx := context.Background()
	mockRepo := newMockInstanceRepository()
	service := &service{repository: mockRepo}

	preferences, err := service.GetPreferences(ctx)
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	if preferences == nil {
		t.Error("Expected preferences, got nil")
		return
	}

	if preferences.GlobalRateLimits.DownloadSpeedLimit != 1000000 {
		t.Errorf("Expected download speed limit 1000000, got %d", preferences.GlobalRateLimits.DownloadSpeedLimit)
	}
}

func TestServicePing(t *testing.T) {
	ctx := context.Background()
	mockRepo := newMockInstanceRepository()
	service := &service{repository: mockRepo}

	// Test successful ping
	err := service.Ping(ctx)
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	// Test ping with error
	mockRepo.pingError = errors.New("connection failed")
	err = service.Ping(ctx)
	if err == nil {
		t.Error("Expected error, got nil")
	}
}

func TestServiceSetDownloadSpeedLimit(t *testing.T) {
	ctx := context.Background()
	mockRepo := newMockInstanceRepository()
	service := &service{repository: mockRepo}

	schema := schemas.InstanceSetSpeedLimitSchema{
		DownloadLimit: 2000000,
	}

	// Test successful download speed limit setting
	err := service.SetSpeedLimit(ctx, schema)
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	// Verify the limit was set
	if mockRepo.preferences.GlobalRateLimits.DownloadSpeedLimit != 2000000 {
		t.Errorf("Expected download speed limit 2000000, got %d", mockRepo.preferences.GlobalRateLimits.DownloadSpeedLimit)
	}

	// Test with repository error
	mockRepo.downloadError = errors.New("failed to set limit")
	err = service.SetSpeedLimit(ctx, schema)
	if err == nil {
		t.Error("Expected error, got nil")
	}
}

func TestServiceSetUploadSpeedLimit(t *testing.T) {
	ctx := context.Background()
	mockRepo := newMockInstanceRepository()
	service := &service{repository: mockRepo}

	schema := schemas.InstanceSetSpeedLimitSchema{
		UploadLimit: 1000000,
	}

	// Test successful upload speed limit setting
	err := service.SetSpeedLimit(ctx, schema)
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	// Verify the limit was set
	if mockRepo.preferences.GlobalRateLimits.UploadSpeedLimit != 1000000 {
		t.Errorf("Expected upload speed limit 1000000, got %d", mockRepo.preferences.GlobalRateLimits.UploadSpeedLimit)
	}

	// Test with repository error
	mockRepo.uploadError = errors.New("failed to set limit")
	err = service.SetSpeedLimit(ctx, schema)
	if err == nil {
		t.Error("Expected error, got nil")
	}
}
