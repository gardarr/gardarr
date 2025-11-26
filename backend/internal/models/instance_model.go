package models

type InstanceResponse struct {
	Application InstanceApplicationResponse `json:"application"`
	Server      InstanceServerResponse      `json:"server"`
	Transfer    InstanceTransferResponse    `json:"transfer"`
}

type InstanceApplicationResponse struct {
	Version    string `json:"version"`
	APIVersion string `json:"api_version"`
}

type InstanceServerResponse struct {
	FreeSpaceOnDisk int `json:"free_space_on_disk"`
}

type InstanceTransferResponse struct {
	AllTimeDownloaded     int     `json:"all_time_downloaded"`
	AllTimeUploaded       int     `json:"all_time_uploaded"`
	GlobalRatio           float64 `json:"global_ratio"`
	LastExternalAddressV4 string  `json:"last_external_address_v4"`
	LastExternalAddressV6 string  `json:"last_external_address_v6"`
}

type InstancePreferencesResponse struct {
	GlobalRateLimits    InstancePreferencesGlobalRateLimitsResponse    `json:"global_rate_limits"`
	ActiveTorrentLimits InstancePreferencesActiveTorrentLimitsResponse `json:"active_torrent_limits"`
}

type InstancePreferencesGlobalRateLimitsResponse struct {
	DownloadSpeedLimit int `json:"download_speed_limit"`
	UploadSpeedLimit   int `json:"upload_speed_limit"`
}

type InstancePreferencesActiveTorrentLimitsResponse struct {
	MaxActiveDownloads        int `json:"max_active_downloads"`
	MaxActiveUploads          int `json:"max_active_uploads"`
	MaxActiveTorrents         int `json:"max_active_torrents"`
	MaxActiveCheckingTorrents int `json:"max_active_checking_torrents"`
}
