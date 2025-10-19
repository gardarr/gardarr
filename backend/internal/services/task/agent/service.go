package task

import (
	"context"
	"sort"
	"strings"

	"github.com/gardarr/gardarr/internal/entities"
	"github.com/gardarr/gardarr/internal/interfaces"
	repository "github.com/gardarr/gardarr/internal/repository/task/agent"
	"github.com/gardarr/gardarr/internal/schemas"
)

type service struct {
	repository interfaces.TaskRepositoryInterface
}

func New() (interfaces.TaskService, error) {
	r, err := repository.New()
	if err != nil {
		return nil, err
	}

	return &service{
		repository: r,
	}, nil
}

func (s *service) ListTasks(ctx context.Context) ([]*entities.Task, error) {
	return s.repository.List()
}

func (s *service) GetTask(ctx context.Context, id string) (*entities.Task, error) {
	return s.repository.Get(id)
}

func (s *service) CreateTask(ctx context.Context, schema schemas.TaskCreateSchema) (*entities.Task, error) {
	uri, err := repository.ParseMagnetLink(schema.MagnetURI)
	if err != nil {
		return nil, err
	}

	list, err := s.repository.List()
	if err != nil {
		return nil, err
	}

	for _, item := range list {
		if strings.EqualFold(item.MagnetLink.Hash, uri.Hash) {
			return item, nil
		}
	}

	return s.repository.Add(schema)
}

func (s *service) StopTask(ctx context.Context, hash string) error {
	return s.repository.Stop(hash)
}

func (s *service) DeleteTask(ctx context.Context, id string, deleteFiles bool) error {
	return s.repository.Delete(id, deleteFiles)
}

func (s *service) StartTask(ctx context.Context, hash string) error {
	return s.repository.Start(hash)
}

func (s *service) ForceResumeTask(ctx context.Context, hash string) error {
	return s.repository.ForceResume(hash)
}

func (s *service) SetTaskShareLimit(ctx context.Context, schema schemas.TaskSetShareLimitSchema) error {
	return s.repository.SetShareLimit(schema)
}

func (s *service) SetTaskLocation(ctx context.Context, hash string, schema schemas.TaskSetLocationSchema) error {
	return s.repository.SetLocation(hash, schema)
}

func (s *service) RenameTask(ctx context.Context, hash string, schema schemas.TaskRenameSchema) error {
	return s.repository.Rename(hash, schema)
}

func (s *service) SetTaskSuperSeeding(ctx context.Context, hash string, schema schemas.TaskSuperSeedingSchema) error {
	return s.repository.SetSuperSeeding(hash, schema)
}

func (s *service) ForceRecheckTask(ctx context.Context, hash string) error {
	return s.repository.ForceRecheck(hash)
}

func (s *service) ForceReannounceTask(ctx context.Context, hash string) error {
	return s.repository.ForceReannounce(hash)
}

func (s *service) SetTaskDownloadLimit(ctx context.Context, hash string, schema schemas.TaskSetDownloadLimitSchema) error {
	return s.repository.SetDownloadLimit(hash, schema)
}

func (s *service) SetTaskUploadLimit(ctx context.Context, hash string, schema schemas.TaskSetUploadLimitSchema) error {
	return s.repository.SetUploadLimit(hash, schema)
}

func (s *service) ListTaskFiles(ctx context.Context, hash string) ([]*entities.TaskFile, error) {
	return s.repository.ListFiles(hash)
}

func (s *service) GetTasksStats(ctx context.Context) (*entities.TaskStats, error) {
	tasks, err := s.repository.List()
	if err != nil {
		return nil, err
	}

	stats := &entities.TaskStats{
		TotalDiskSize:        0,
		CurrentUploadSpeed:   0,
		CurrentDownloadSpeed: 0,
		AverageRatio:         0,
		MedianRatio:          0,
		HighestRatio:         0,
		LowestRatio:          0,
		ActiveTasksCount:     0,
		ActiveSeeds:          0,
		ActivePeers:          0,
		CategoryUsage:        make(map[string]int),
		TagsUsage:            make(map[string]int),
	}

	if len(tasks) == 0 {
		return stats, nil
	}

	var totalRatio float64
	var ratios []float64
	var totalUploadSpeed, totalDownloadSpeed int

	for _, task := range tasks {
		// Calculate total disk size
		stats.TotalDiskSize += int64(task.Size)

		// Calculate current speeds
		totalUploadSpeed += task.Network.Upload.Speed
		totalDownloadSpeed += task.Network.Download.Speed

		// Count active tasks (assuming active means not in error state)
		if task.State != "error" && task.State != "paused" {
			stats.ActiveTasksCount++
		}

		// Count active seeds and peers
		stats.ActiveSeeds += task.Pairs.Seeders
		stats.ActivePeers += task.Pairs.Leechers

		// Calculate ratios for average and median
		totalRatio += task.Ratio
		ratios = append(ratios, task.Ratio)

		// Count category usage
		if task.Category != "" {
			stats.CategoryUsage[task.Category]++
		}

		// Count tags usage
		for _, tag := range task.Tags {
			if tag != "" {
				stats.TagsUsage[tag]++
			}
		}
	}

	// Calculate average ratio
	stats.AverageRatio = totalRatio / float64(len(tasks))

	// Calculate median ratio
	sort.Float64s(ratios)
	if len(ratios) > 0 {
		if len(ratios)%2 == 0 {
			stats.MedianRatio = (ratios[len(ratios)/2-1] + ratios[len(ratios)/2]) / 2
		} else {
			stats.MedianRatio = ratios[len(ratios)/2]
		}

		// Calculate highest and lowest ratios
		stats.HighestRatio = ratios[len(ratios)-1]
		stats.LowestRatio = ratios[0]
	}

	// Set current speeds
	stats.CurrentUploadSpeed = totalUploadSpeed
	stats.CurrentDownloadSpeed = totalDownloadSpeed

	return stats, nil
}
