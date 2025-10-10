package task

import (
	"strconv"

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
		BaseURL:  env.Get("QBITTORRENT_BASEURL").Value(),
		Username: env.Get("QBITTORRENT_USERNAME").Value(),
		Password: env.Get("QBITTORRENT_PASSWORD").Value(),
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
