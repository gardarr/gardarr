package constants


const (
	WorkerPortEnv               = "WORKER_PORT"
	WorkerSecretEnv             = "WORKER_SECRET"
	WorkerTimeoutSecondsEnv     = "WORKER_TIMEOUT_SECONDS"
	DefaultWorkerTimeoutSeconds = 10

	QBittorrentRequestTimeoutSecondsEnv = "QBITTORRENT_REQUEST_TIMEOUT_SECONDS"
	QBittorrentMaxRetriesEnv            = "QBITTORRENT_MAX_RETRIES"
	QBittorrentRetryBackoffEnv          = "QBITTORRENT_RETRY_BACKOFF"
	QBittorrentLoginMaxRetriesEnv       = "QBITTORRENT_LOGIN_MAX_RETRIES"
	QBittorrentBaseURLEnv               = "QBITTORRENT_URL"
	QBittorrentBaseURLOldEnv            = "QBITTORRENT_BASEURL" // Deprecated: use QBITTORRENT_URL
	QBittorrentUsernameEnv              = "QBITTORRENT_USERNAME"
	QBittorrentPasswordEnv              = "QBITTORRENT_PASSWORD"
)

const (
	WorkerStatusActive   = "ACTIVE"
	WorkerStatusErrored  = "ERRORED"
	WorkerStatusInactive = "INACTIVE"
)
