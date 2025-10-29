package agent

import (
	"context"
	"strconv"
	"time"

	"github.com/gardarr/gardarr/internal/constants"
	"github.com/gardarr/gardarr/internal/entities"
	"github.com/gardarr/gardarr/pkg/env"
	"github.com/jfxdev/go-qbt"
	"github.com/pkg/errors"
)

type Repository struct {
	client *qbt.Client
}

func New() (*Repository, error) {
	client, err := qbt.New(qbt.Config{
		BaseURL:        env.Get(constants.QBittorrentBaseURLEnv).Value(),
		Username:       env.Get(constants.QBittorrentUsernameEnv).Value(),
		Password:       env.Get(constants.QBittorrentPasswordEnv).Value(),
		RequestTimeout: time.Duration(env.Get(constants.QBittorrentRequestTimeoutSecondsEnv).Default(3).ValueInt()) * time.Second,
		MaxRetries:     env.Get(constants.QBittorrentMaxRetriesEnv).Default(0).ValueInt(),
		RetryBackoff:   time.Duration(env.Get(constants.QBittorrentRetryBackoffEnv).Default(1).ValueInt()) * time.Second,
	})
	if err != nil {
		return nil, err
	}

	return &Repository{
		client: client,
	}, nil
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

	return &entities.InstancePreferences{
		GlobalRateLimits: entities.InstancePreferencesGlobalRateLimits{
			DownloadSpeedLimit:        settings.GlobalDLSpeedLimit,
			DownloadSpeedLimitEnabled: settings.GlobalDLSpeedLimitEnabled,
			UploadSpeedLimit:          settings.GlobalUPSpeedLimit,
			UploadSpeedLimitEnabled:   settings.GlobalUPSpeedLimitEnabled,
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

func (s *Repository) SetDownloadSpeedLimit(limit int) error {
	if err := s.client.SetDownloadSpeedLimit(limit); err != nil {
		return errors.Wrap(err, "failed to set download speed limit")
	}

	return nil
}

func (s *Repository) SetUploadSpeedLimit(limit int) error {
	if err := s.client.SetUploadSpeedLimit(limit); err != nil {
		return errors.Wrap(err, "failed to set upload speed limit")
	}

	return nil
}
