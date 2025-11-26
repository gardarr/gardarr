package entities

type Instance struct {
	Server      InstanceServer
	Application InstanceApplication
	Transfer    InstanceTransfer
}

type InstancePreferences struct {
	GlobalRateLimits    InstancePreferencesGlobalRateLimits
	ActiveTorrentLimits InstancePreferencesActiveTorrentLimits
}

type InstancePreferencesGlobalRateLimits struct {
	DownloadSpeedLimit int
	UploadSpeedLimit   int
}

type InstancePreferencesActiveTorrentLimits struct {
	MaxActiveDownloads        int
	MaxActiveUploads          int
	MaxActiveTorrents         int
	MaxActiveCheckingTorrents int
}

type InstanceApplication struct {
	Version    string
	APIVersion string
}

type InstanceServer struct {
	FreeSpaceOnDisk int
}

type InstanceTransfer struct {
	AllTimeDownloaded     int
	AllTimeUploaded       int
	GlobalRatio           float64
	LastExternalAddressV4 string
	LastExternalAddressV6 string
}
