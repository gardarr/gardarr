package entities

const (
	// ConnectionStatus status values
	ConnectionStatusConnected    = "connected"
	ConnectionStatusUnauthorized = "unauthorized"
	ConnectionStatusUnaccessible = "unaccessible"
	ConnectionStatusInitializing = "initializing"
	ConnectionStatusPending      = "pending"
)

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

// ConnectionStatus represents the detailed connection state
type ConnectionStatus struct {
	Status    string         // One of ConnectionStatus* constants
	ErrorCode AgentErrorCode // Specific error code
	Message   string         // Human-readable error message
	Permanent bool           // True if error requires user intervention
}
