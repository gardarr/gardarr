package constants

const (
	UnknownStatus = "unknown"
)

// Task status constants (normalized values)
const (
	TaskStatusUploading       = "UPLOADING"
	TaskStatusStalledUpload   = "STALLED_UPLOAD"
	TaskStatusDownloading     = "DOWNLOADING"
	TaskStatusStalledDownload = "STALLED_DOWNLOAD"
	TaskStatusError           = "ERROR"
	TaskStatusMissingFiles    = "MISSING_FILES"
)
