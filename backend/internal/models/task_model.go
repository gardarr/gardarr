package models

import "time"

type TaskResponseModel struct {
	ID           string                   `json:"id"`
	WorkerID     string                   `json:"worker_id,omitempty"`
	Name         string                   `json:"name"`
	Hash         string                   `json:"hash"`
	CreatedAt    time.Time                `json:"created_at"`
	CompletedAt  *time.Time               `json:"completed_at,omitempty"`
	State        string                   `json:"state"`
	Category     string                   `json:"category"`
	Path         string                   `json:"path"`
	Priority     int                      `json:"priority"`
	Ratio        float64                  `json:"ratio"`
	SuperSeeding bool                     `json:"super_seeding"`
	Size         int                      `json:"size"`
	Progress     float64                  `json:"progress"`
	Active       bool                     `json:"active"`
	Popularity   float64                  `json:"popularity"`
	MagnetURI    string                   `json:"magnet_uri"`
	MagnetLink   *TaskMagnetLinkResponse  `json:"magnet_link"`
	Pairs        TaskPairsResponse        `json:"pairs"`
	Network      TaskNetworkResponseModel `json:"network"`
	Tags         []string                 `json:"tags,omitempty"`
	Metadata     *TaskMetadataResponse    `json:"metadata,omitempty"`
	WasCreated   bool                     `json:"was_created"`
}

type TaskMagnetLinkResponse struct {
	Hash        string   `json:"hash"`
	DisplayName string   `json:"display_name"`
	Trackers    []string `json:"trackers"`
	ExactLength string   `json:"exact_length"`
	ExactSource string   `json:"exact_source"`
}

type TaskPairsResponse struct {
	SwarmSeeders  int `json:"swarm_seeders"`
	SwarmLeechers int `json:"swarm_leechers"`
	Seeders       int `json:"seeders"`
	Leechers      int `json:"leechers"`
}

type TaskNetworkResponseModel struct {
	Download TaskDownloadResponseModel `json:"download"`
	Upload   TaskUploadResponseModel   `json:"upload"`
}

type TaskDownloadResponseModel struct {
	Speed  int `json:"speed"`
	Amount int `json:"amount"`
}

type TaskUploadResponseModel struct {
	Speed  int `json:"speed"`
	Amount int `json:"amount"`
}

type TaskFileResponse struct {
	Index        int     `json:"index"`
	Name         string  `json:"name"`
	Size         int64   `json:"size"`
	Progress     float64 `json:"progress"`
	Priority     int     `json:"priority"`
	IsSeed       bool    `json:"is_seed"`
	PieceRange   [2]int  `json:"piece_range"`
	Availability float64 `json:"availability"`
}

type TaskTrackerResponse struct {
	URL           string `json:"url"`
	Status        int    `json:"status"`
	Tier          int    `json:"tier"`
	NumPeers      int    `json:"num_peers"`
	NumSeeds      int    `json:"num_seeds"`
	NumLeeches    int    `json:"num_leeches"`
	NumDownloaded int    `json:"num_downloaded"`
	Message       string `json:"message,omitempty"`
}

type TaskStatsResponse struct {
	TotalDiskSize        int64          `json:"total_disk_size"`
	CurrentUploadSpeed   int            `json:"current_upload_speed"`
	CurrentDownloadSpeed int            `json:"current_download_speed"`
	AverageRatio         float64        `json:"average_ratio"`
	MedianRatio          float64        `json:"median_ratio"`
	HighestRatio         float64        `json:"highest_ratio"`
	LowestRatio          float64        `json:"lowest_ratio"`
	ActiveTasksCount     int            `json:"active_tasks_count"`
	TotalTasksCount      int            `json:"total_tasks_count"`
	ActiveSeeds          int            `json:"active_seeds"`
	ActivePeers          int            `json:"active_peers"`
	SwarmSeeders         int            `json:"swarm_seeders"`
	SwarmLeechers        int            `json:"swarm_leechers"`
	CategoryUsage        map[string]int `json:"category_usage"`
	TagsUsage            map[string]int `json:"tags_usage"`
	WordCloud            map[string]int `json:"word_cloud"`
}

type TaskLimitsResponse struct {
	DownloadLimit            int     `json:"download_limit"`
	UploadLimit              int     `json:"upload_limit"`
	ShareLimit               float64 `json:"share_limit"` // Deprecated: use specific limits below
	RatioLimit               float64 `json:"ratio_limit"`
	SeedingTimeLimit         int     `json:"seeding_time_limit"`
	InactiveSeedingTimeLimit int     `json:"inactive_seeding_time_limit"`
}
