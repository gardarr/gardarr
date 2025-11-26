package agent

import (
	"context"
	"strconv"

	"github.com/jfxdev/gardarr/internal/entities"
	"github.com/jfxdev/go-qbt"
	"github.com/pkg/errors"
)

type Repository struct {
	client *qbt.Client
}

func New(client *qbt.Client) *Repository {
	return &Repository{
		client: client,
	}
}

func (s *Repository) GetInstance() (*entities.Instance, error) {
	mainData, err := s.client.GetMainData()
	if err != nil {
		return nil, errors.Wrap(err, "failed to get main data")
	}

	version, err := s.client.GetAppVersion()
	if err != nil {
		return nil, errors.Wrap(err, "failed to get app version")
	}

	apiVersion, err := s.client.GetAPIVersion()
	if err != nil {
		return nil, errors.Wrap(err, "failed to get api version")
	}

	var globalRatio float64
	if mainData.ServerState.GlobalRatio != "" {
		var err error
		globalRatio, err = strconv.ParseFloat(mainData.ServerState.GlobalRatio, 64)
		if err != nil {
			return nil, errors.Wrap(err, "failed to parse global ratio")
		}
	}
	// If GlobalRatio is empty, globalRatio remains 0.0 (default value)

	return &entities.Instance{
		Application: entities.InstanceApplication{
			Version:    version,
			APIVersion: apiVersion,
		},
		Server: entities.InstanceServer{
			FreeSpaceOnDisk: mainData.ServerState.FreeSpaceOnDisk,
		},
		Transfer: entities.InstanceTransfer{
			AllTimeDownloaded:     mainData.ServerState.AllTimeDownloaded,
			AllTimeUploaded:       mainData.ServerState.AllTimeUploaded,
			GlobalRatio:           globalRatio,
			LastExternalAddressV4: mainData.ServerState.LastExternalAddressV4,
			LastExternalAddressV6: mainData.ServerState.LastExternalAddressV6,
		},
	}, nil
}

func (s *Repository) GetPreferences(ctx context.Context) (*entities.InstancePreferences, error) {
	settings, err := s.client.GetGlobalSettings()
	if err != nil {
		return nil, errors.Wrap(err, "failed to get global settings")
	}

	globalDownloadLimit, err := s.client.GetGlobalDownloadLimit()
	if err != nil {
		return nil, errors.Wrap(err, "failed to get global download limit")
	}

	globalUploadLimit, err := s.client.GetGlobalUploadLimit()
	if err != nil {
		return nil, errors.Wrap(err, "failed to get global upload limit")
	}

	return &entities.InstancePreferences{
		GlobalRateLimits: entities.InstancePreferencesGlobalRateLimits{
			DownloadSpeedLimit: globalDownloadLimit,
			UploadSpeedLimit:   globalUploadLimit,
		},
		ActiveTorrentLimits: entities.InstancePreferencesActiveTorrentLimits{
			MaxActiveDownloads:        settings.MaxActiveDownloads,
			MaxActiveUploads:          settings.MaxActiveUploads,
			MaxActiveTorrents:         settings.MaxActiveTorrents,
			MaxActiveCheckingTorrents: settings.MaxActiveCheckingTorrents,
		},
	}, nil
}

func (s *Repository) Ping() error {
	version, err := s.client.GetAppVersion()
	if err != nil {
		return errors.Wrap(err, "failed to get app version")
	}

	if version == "" {
		return errors.New("failed to get app version")
	}

	return nil
}

func (s *Repository) GetStatus() string {
	return s.client.GetStatus()
}

func (s *Repository) SetDownloadSpeedLimit(limit int) error {
	if err := s.client.SetGlobalDownloadSpeedLimit(limit); err != nil {
		return errors.Wrap(err, "failed to set download speed limit")
	}

	return nil
}

func (s *Repository) SetUploadSpeedLimit(limit int) error {
	if err := s.client.SetGlobalUploadSpeedLimit(limit); err != nil {
		return errors.Wrap(err, "failed to set upload speed limit")
	}

	return nil
}

func (s *Repository) SetMaxActiveTorrentLimits(maxDownloads, maxUploads, maxTorrents, maxChecking int) error {
	if err := s.client.SetMaxActiveTorrentLimits(maxDownloads, maxUploads, maxTorrents, maxChecking); err != nil {
		return errors.Wrap(err, "failed to set max active torrent limits")
	}

	return nil
}
