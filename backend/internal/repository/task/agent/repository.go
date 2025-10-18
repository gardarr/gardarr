package task

import (
	"strings"

	"github.com/gardarr/gardarr/cmd/constants"
	"github.com/gardarr/gardarr/internal/entities"
	"github.com/gardarr/gardarr/internal/schemas"
	"github.com/gardarr/gardarr/pkg/env"
	"github.com/jfxdev/go-qbt"

	"github.com/gardarr/gardarr/pkg/errors"
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

func (s *Repository) List() ([]*entities.Task, error) {
	items, err := s.client.ListTorrents(qbt.ListOptions{})
	if err != nil {
		return nil, err
	}

	result := make([]*entities.Task, len(items))
	for i, item := range items {
		result[i] = toTask(item)
	}

	return result, nil
}

func (s *Repository) Get(hash string) (*entities.Task, error) {
	items, err := s.client.ListTorrents(qbt.ListOptions{})
	if err != nil {
		return nil, err
	}

	for _, item := range items {
		if item.Hash == hash {
			return toTask(item), nil
		}
	}

	return nil, errors.ErrTaskNotFound
}

func (s *Repository) Add(schema schemas.TaskCreateSchema) (*entities.Task, error) {
	if err := s.client.AddTorrentLink(qbt.TorrentConfig{
		MagnetURI: schema.MagnetURI,
		Category:  schema.Category,
		Directory: schema.Directory,
	}); err != nil {
		return nil, errors.Wrap(err, "failed to add task")
	}

	list, err := s.client.ListTorrents(qbt.ListOptions{
		Category: schema.Category,
	})
	if err != nil {
		return nil, err
	}

	uri, err := qbt.ParseMagnetLink(schema.MagnetURI)
	if err != nil {
		return nil, errors.Wrap(err, "failed to parse magnet link")
	}

	var task *qbt.TorrentResponse
	for _, item := range list {
		if strings.EqualFold(item.MagnetLink.Hash, uri.Hash) {
			task = item
			if err := s.client.AddTorrentTags(task.Hash, schema.Tags); err != nil {
				return nil, err
			}
			break
		}
	}

	return toTask(task), nil
}

func (s *Repository) Stop(hash string) error {
	if err := s.client.StopTorrents(hash); err != nil {
		return errors.Wrap(err, "failed to stop torrent")
	}

	return nil
}

func (s *Repository) Delete(id string, deleteFiles bool) error {
	if err := s.client.DeleteTorrents(id, deleteFiles); err != nil {
		return errors.Wrap(err, "failed to delete torrent")
	}

	return nil
}

func (s *Repository) Start(hash string) error {
	if err := s.client.StartTorrents(hash); err != nil {
		return errors.Wrap(err, "failed to start torrent")
	}

	return nil
}

func (s *Repository) ForceResume(hash string) error {
	if err := s.client.ForceStart(hash); err != nil {
		return errors.Wrap(err, "failed to force resume torrent")
	}

	return nil
}

func (s *Repository) SetTags(hash string, tags []string) error {
	items, err := s.client.ListTorrents(qbt.ListOptions{})
	if err != nil {
		return err
	}

	for _, item := range items {
		if item.Hash == hash {
			return s.client.AddTorrentTags(hash, tags)
		}
	}

	return errors.ErrTaskNotFound
}

func (s *Repository) SetShareLimit(schema schemas.TaskSetShareLimitSchema) error {
	if err := s.client.SetTorrentShareLimit(schema.Hash, schema.RatioLimit, schema.SeedingTimeLimit); err != nil {
		return errors.Wrap(err, "failed to set torrent share limit")
	}

	return nil
}

func (s *Repository) SetLocation(hash string, schema schemas.TaskSetLocationSchema) error {
	if err := s.client.SetTorrentLocation(hash, schema.Location); err != nil {
		return errors.Wrap(err, "failed to set torrent location")
	}

	return nil
}

func (s *Repository) Rename(hash string, schema schemas.TaskRenameSchema) error {
	if err := s.client.RenameTorrent(hash, schema.NewName); err != nil {
		return errors.Wrap(err, "failed to rename torrent")
	}

	return nil
}

func ParseMagnetLink(magnetURI string) (*entities.TaskMagnetLink, error) {
	uri, err := qbt.ParseMagnetLink(magnetURI)
	if err != nil {
		return nil, errors.Wrap(err, "failed to parse magnet link")
	}

	return &entities.TaskMagnetLink{
		Hash:        uri.Hash,
		DisplayName: uri.DisplayName,
		Trackers:    uri.Trackers,
		ExactLength: uri.ExactLength,
		ExactSource: uri.ExactSource,
	}, nil
}

func (s *Repository) SetSuperSeeding(hash string, schema schemas.TaskSuperSeedingSchema) error {
	if err := s.client.SuperSeedingMode(hash, schema.Enabled); err != nil {
		return errors.Wrap(err, "failed to set super seeding mode")
	}

	return nil
}

func (s *Repository) ForceRecheck(hash string) error {
	if err := s.client.ForceRecheck(hash); err != nil {
		return errors.Wrap(err, "failed to force recheck torrent")
	}

	return nil
}

func (s *Repository) ForceReannounce(hash string) error {
	if err := s.client.ForceReannounce(hash); err != nil {
		return errors.Wrap(err, "failed to force reannounce torrent")
	}

	return nil
}

func (s *Repository) SetDownloadLimit(hash string, schema schemas.TaskSetDownloadLimitSchema) error {
	if err := s.client.SetTorrentDownloadLimit(hash, schema.Limit); err != nil {
		return errors.Wrap(err, "failed to set torrent download limit")
	}

	return nil
}

func (s *Repository) SetUploadLimit(hash string, schema schemas.TaskSetUploadLimitSchema) error {
	if err := s.client.SetTorrentUploadLimit(hash, schema.Limit); err != nil {
		return errors.Wrap(err, "failed to set torrent upload limit")
	}

	return nil
}

func (s *Repository) ListFiles(hash string) ([]*entities.TaskFile, error) {
	files, err := s.client.ListTorrentFiles(hash)
	if err != nil {
		return nil, errors.Wrap(err, "failed to list torrent files")
	}

	result := make([]*entities.TaskFile, len(files))
	for i, file := range files {
		result[i] = &entities.TaskFile{
			Name:         file.Name,
			Size:         file.Size,
			Progress:     file.Progress,
			Priority:     file.Priority,
			IsSeed:       file.IsSeed,
			PieceRange:   file.PieceRange,
			Availability: file.Availability,
		}
	}

	return result, nil
}

func toTask(item *qbt.TorrentResponse) *entities.Task {
	status := entities.TaskStatuses[constants.UnknownStatus]
	if value, ok := entities.TaskStatuses[item.State]; ok {
		status = value
	}

	return &entities.Task{
		ID:         item.Hash,
		Name:       item.Name,
		Hash:       item.Hash,
		Category:   item.Category,
		Path:       item.SavePath,
		State:      status,
		Size:       item.Size,
		Priority:   item.Priority,
		Ratio:      item.Ratio,
		Progress:   item.Progress * 100,
		Popularity: item.Popularity,
		MagnetURI:  item.MagnetURI,
		MagnetLink: entities.TaskMagnetLink{
			Hash:        item.MagnetLink.Hash,
			DisplayName: item.MagnetLink.DisplayName,
			Trackers:    item.MagnetLink.Trackers,
			ExactLength: item.MagnetLink.ExactLength,
			ExactSource: item.MagnetLink.ExactSource,
		},
		Pairs: entities.TaskPairs{
			SwarmSeeders:  item.NumComplete,
			SwarmLeechers: item.NumIncomplete,
			Seeders:       item.NumSeeds,
			Leechers:      item.NumLeechs,
		},
		NumSeeds: item.NumSeeds,
		Tags:     strings.Split(item.Tags, ","),
		Network: entities.TaskNetwork{
			Download: entities.TaskDownload{
				Speed:  item.Dlspeed,
				Amount: item.Downloaded,
			},
			Upload: entities.TaskUpload{
				Speed:  item.Upspeed,
				Amount: item.Uploaded,
			},
		},
	}
}
