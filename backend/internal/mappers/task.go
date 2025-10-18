package mappers

import (
	"github.com/gardarr/gardarr/internal/entities"
	"github.com/gardarr/gardarr/internal/models"
)

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
		NumSeeds: e.Pairs.Seeders,
		Tags:     e.Tags,
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
		ID:         e.ID,
		Agent:      ToAgentResponse(e.Agent),
		Name:       e.Name,
		Hash:       e.Hash,
		State:      e.State,
		Priority:   e.Priority,
		Popularity: e.Popularity,
		MagnetLink: &models.TaskMagnetLinkResponse{
			Hash:        e.MagnetLink.Hash,
			DisplayName: e.MagnetLink.DisplayName,
			Trackers:    e.MagnetLink.Trackers,
			ExactLength: e.MagnetLink.ExactLength,
			ExactSource: e.MagnetLink.ExactSource,
		},
		MagnetURI: e.MagnetURI,
		Category:  e.Category,
		Path:      e.Path,
		Ratio:     e.Ratio,
		Size:      e.Size,
		Progress:  e.Progress,
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
