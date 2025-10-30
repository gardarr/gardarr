package mappers

import (
	"github.com/gardarr/gardarr/internal/entities"
	"github.com/gardarr/gardarr/internal/models"
)

// ToTask converts a models.TaskResponseModel into an *entities.Task.
// If e.State matches a key in entities.TaskStatuses, the mapped status value is used for the resulting Task's State.
func ToTask(e models.TaskResponseModel) *entities.Task {
	status := e.State
	if value, ok := entities.TaskStatuses[e.State]; ok {
		status = value
	}

	return &entities.Task{
		ID:       e.Hash,
		Name:     e.Name,
		Hash:     e.Hash,
		Category: e.Category,
		Path:     e.Path,
		State:    status,
		Size:     e.Size,
		Priority: e.Priority,
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

// ToTaskResponse converts an entities.Task to a models.TaskResponseModel.
// If e is nil, it returns an empty TaskResponseModel.
// The returned model mirrors the entity's fields, including Agent, MagnetLink,
// Pairs, Network, and task metadata such as ID, Name, Hash, State, Priority,
// Active, Popularity, Category, Path, Ratio, Size, Progress, Tags and SuperSeeding.
func ToTaskResponse(e *entities.Task) models.TaskResponseModel {
	if e == nil {
		return models.TaskResponseModel{}
	}

	return models.TaskResponseModel{
		ID:         e.ID,
		Agent:      ToAgentResponse(e.Agent),
		Name:       e.Name,
		Hash:       e.Hash,
		State:      e.State,
		Priority:   e.Priority,
		Active:     e.Active,
		Popularity: e.Popularity,
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
		Tags: e.Tags,
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

// ToTaskStatsResponse converts a TaskStats entity into a TaskStatsResponse model.
// It maps each statistical field from the entity to the response model.
// Panics if e is nil.
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

// ToTaskStats converts a models.TaskStatsResponse to an entities.TaskStats.
// The returned entity is populated with the corresponding statistics fields from the input model.
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