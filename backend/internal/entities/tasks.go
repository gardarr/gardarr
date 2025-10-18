package entities

type Task struct {
	ID         string
	Agent      *Agent
	Name       string
	Hash       string
	State      string
	Category   string
	Path       string
	Size       int
	Priority   int
	Ratio      float64
	Progress   float64
	Popularity float64
	MagnetLink TaskMagnetLink
	Tags       []string
	MagnetURI  string
	Pairs      TaskPairs
	NumSeeds   int
	Network    TaskNetwork
}

type TaskMagnetLink struct {
	Hash        string   `json:"hash"`
	DisplayName string   `json:"display_name"`
	Trackers    []string `json:"trackers"`
	ExactLength string   `json:"exact_length"`
	ExactSource string   `json:"exact_source"`
}

type TaskPairs struct {
	SwarmSeeders  int
	SwarmLeechers int
	Seeders       int
	Leechers      int
}

type TaskNetwork struct {
	Download TaskDownload
	Upload   TaskUpload
}

type TaskDownload struct {
	Speed  int
	Amount int
}

type TaskUpload struct {
	Speed  int
	Amount int
}

type TaskCreationConfig struct {
	URI       string
	Category  string
	Tags      []string
	Directory string
}

type TaskFile struct {
	Name         string
	Size         int64
	Progress     float64
	Priority     int
	IsSeed       bool
	PieceRange   [2]int
	Availability float64
}

// TaskStatuses is the map reference of status in qBittorrent API
var TaskStatuses = map[string]string{
	"error":              "ERROR",
	"missingFiles":       "MISSING_FILES",
	"uploading":          "UPLOADING",
	"pausedUP":           "PAUSED_UPLOAD",
	"stoppedUP":          "STOPPED_UPLOAD",
	"queuedUP":           "QUEUED_UPLOAD",
	"stalledUP":          "STALLED_UPLOAD",
	"checkingUP":         "CHECKING_UPLOAD",
	"forcedUP":           "FORCED_UPLOAD",
	"allocating":         "ALLOCATING",
	"downloading":        "DOWNLOADING",
	"metaDL":             "METADATA_DOWNLOAD",
	"forcedMetaDL":       "FORCED_METADATA_DOWNLOAD",
	"pausedDL":           "PAUSED_DOWNLOAD",
	"stoppedDL":          "STOPPED_DOWNLOAD",
	"queuedDL":           "QUEUED_DOWNLOAD",
	"forcedDL":           "FORCED_DOWNLOAD",
	"stalledDL":          "STALLED_DOWNLOAD",
	"checkingDL":         "CHECKING_DOWNLOAD",
	"checkingResumeData": "CHECKING_RESUME_DATA",
	"moving":             "MOVING",
	"unknown":            "UNKNOWN",
}
