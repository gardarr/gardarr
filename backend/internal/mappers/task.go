package mappers

import (
	"github.com/jfxdev/gardarr/internal/entities"
	"github.com/jfxdev/gardarr/internal/models"
)

func ToTask(e models.TaskResponseModel) *entities.Task {
	status := e.State
	if value, ok := entities.TaskStatuses[e.State]; ok {
		status = value
	}

	return &entities.Task{
		ID:          e.Hash,
		Name:        e.Name,
		Hash:        e.Hash,
		CreatedAt:   e.CreatedAt,
		CompletedAt: e.CompletedAt,
		Category:    e.Category,
		Path:        e.Path,
		State:       status,
		Size:        e.Size,
		Priority:    e.Priority,
		MagnetLink: entities.TaskMagnetLink{
			Hash:        e.MagnetLink.Hash,
			DisplayName: e.MagnetLink.DisplayName,
			Trackers:    e.MagnetLink.Trackers,
			ExactLength: e.MagnetLink.ExactLength,
			ExactSource: e.MagnetLink.ExactSource,
		},
		MagnetURI:  e.MagnetURI,
		Popularity: e.Popularity,
		Ratio:      e.Ratio,
		Progress:   e.Progress,
		Pairs: entities.TaskPairs{
			SwarmSeeders:  e.Pairs.SwarmSeeders,
			SwarmLeechers: e.Pairs.SwarmLeechers,
			Seeders:       e.Pairs.Seeders,
			Leechers:      e.Pairs.Leechers,
		},
		NumSeeds:     e.Pairs.Seeders,
		SuperSeeding: e.SuperSeeding,
		Active:       e.Active,
		Tags:         e.Tags,
		Network: entities.TaskNetwork{
			Download: entities.TaskDownload{
				Speed:  e.Network.Download.Speed,
				Amount: e.Network.Download.Amount,
			},
			Upload: entities.TaskUpload{
				Speed:  e.Network.Upload.Speed,
				Amount: e.Network.Upload.Amount,
			},
		},
	}
}

func ToTaskResponse(e *entities.Task) models.TaskResponseModel {
	if e == nil {
		return models.TaskResponseModel{}
	}

	return models.TaskResponseModel{
		ID:          e.ID,
		Name:        e.Name,
		Hash:        e.Hash,
		CreatedAt:   e.CreatedAt,
		CompletedAt: e.CompletedAt,
		State:       e.State,
		Priority:    e.Priority,
		Active:      e.Active,
		Popularity:  e.Popularity,
		MagnetLink: &models.TaskMagnetLinkResponse{
			Hash:        e.MagnetLink.Hash,
			DisplayName: e.MagnetLink.DisplayName,
			Trackers:    e.MagnetLink.Trackers,
			ExactLength: e.MagnetLink.ExactLength,
			ExactSource: e.MagnetLink.ExactSource,
		},
		MagnetURI:    e.MagnetURI,
		SuperSeeding: e.SuperSeeding,
		Category:     e.Category,
		Path:         e.Path,
		Ratio:        e.Ratio,
		Size:         e.Size,
		Progress:     e.Progress,
		Pairs: models.TaskPairsResponse{
			SwarmSeeders:  e.Pairs.SwarmSeeders,
			SwarmLeechers: e.Pairs.SwarmLeechers,
			Seeders:       e.Pairs.Seeders,
			Leechers:      e.Pairs.Leechers,
		},
		Tags:     e.Tags,
		Metadata: ToTaskMetadataResponse(e.Metadata),
		Network: models.TaskNetworkResponseModel{
			Download: models.TaskDownloadResponseModel{
				Speed:  e.Network.Download.Speed,
				Amount: e.Network.Download.Amount,
			},
			Upload: models.TaskUploadResponseModel{
				Speed:  e.Network.Upload.Speed,
				Amount: e.Network.Upload.Amount,
			},
		},
	}

}

func ToTaskFileResponse(e *entities.TaskFile) models.TaskFileResponse {
	return models.TaskFileResponse{
		Name:         e.Name,
		Size:         e.Size,
		Progress:     e.Progress,
		Priority:     e.Priority,
		IsSeed:       e.IsSeed,
		PieceRange:   e.PieceRange,
		Availability: e.Availability,
	}
}

func ToTaskFilesResponse(files []*entities.TaskFile) []models.TaskFileResponse {
	if files == nil {
		return []models.TaskFileResponse{}
	}

	response := make([]models.TaskFileResponse, len(files))
	for i, file := range files {
		response[i] = ToTaskFileResponse(file)
	}
	return response
}

func ToTaskStatsResponse(e *entities.TaskStats) models.TaskStatsResponse {
	return models.TaskStatsResponse{
		TotalDiskSize:        e.TotalDiskSize,
		CurrentUploadSpeed:   e.CurrentUploadSpeed,
		CurrentDownloadSpeed: e.CurrentDownloadSpeed,
		AverageRatio:         e.AverageRatio,
		MedianRatio:          e.MedianRatio,
		HighestRatio:         e.HighestRatio,
		LowestRatio:          e.LowestRatio,
		ActiveTasksCount:     e.ActiveTasksCount,
		TotalTasksCount:      e.TotalTasksCount,
		ActiveSeeds:          e.ActiveSeeds,
		ActivePeers:          e.ActivePeers,
		SwarmSeeders:         e.SwarmSeeders,
		SwarmLeechers:        e.SwarmLeechers,
		CategoryUsage:        e.CategoryUsage,
		TagsUsage:            e.TagsUsage,
		WordCloud:            e.WordCloud,
	}
}

func ToTaskStats(m models.TaskStatsResponse) *entities.TaskStats {
	return &entities.TaskStats{
		TotalDiskSize:        m.TotalDiskSize,
		CurrentUploadSpeed:   m.CurrentUploadSpeed,
		CurrentDownloadSpeed: m.CurrentDownloadSpeed,
		AverageRatio:         m.AverageRatio,
		MedianRatio:          m.MedianRatio,
		HighestRatio:         m.HighestRatio,
		LowestRatio:          m.LowestRatio,
		ActiveTasksCount:     m.ActiveTasksCount,
		TotalTasksCount:      m.TotalTasksCount,
		ActiveSeeds:          m.ActiveSeeds,
		ActivePeers:          m.ActivePeers,
		SwarmSeeders:         m.SwarmSeeders,
		SwarmLeechers:        m.SwarmLeechers,
		CategoryUsage:        m.CategoryUsage,
		TagsUsage:            m.TagsUsage,
		WordCloud:            m.WordCloud,
	}
}

func ToTaskLimitsResponse(e *entities.TaskLimits) models.TaskLimitsResponse {
	return models.TaskLimitsResponse{
		DownloadLimit:            e.DownloadLimit,
		UploadLimit:              e.UploadLimit,
		ShareLimit:               e.ShareLimit,
		RatioLimit:               e.RatioLimit,
		SeedingTimeLimit:         e.SeedingTimeLimit,
		InactiveSeedingTimeLimit: e.InactiveSeedingTimeLimit,
	}
}

func ToTaskLimits(m models.TaskLimitsResponse) *entities.TaskLimits {
	return &entities.TaskLimits{
		DownloadLimit:            m.DownloadLimit,
		UploadLimit:              m.UploadLimit,
		ShareLimit:               m.ShareLimit,
		RatioLimit:               m.RatioLimit,
		SeedingTimeLimit:         m.SeedingTimeLimit,
		InactiveSeedingTimeLimit: m.InactiveSeedingTimeLimit,
	}
}
