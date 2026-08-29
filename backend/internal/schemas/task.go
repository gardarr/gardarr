package schemas

type TaskCreateSchema struct {
	MagnetURI string   `json:"magnet_uri" binding:"required"`
	Category  string   `json:"category"`
	Directory string   `json:"directory"`
	Tags      []string `json:"tags"`
}

// TaskCreateFromFileSchema carries the multipart form fields that accompany
// an uploaded .torrent file (the file itself arrives as the "torrent" part).
type TaskCreateFromFileSchema struct {
	Category  string   `form:"category"`
	Directory string   `form:"directory"`
	Tags      []string `form:"tags"`
}

type TaskDeleteSchema struct {
	ID string `uri:"id" binding:"required"`
}

type TaskDeleteOptionsSchema struct {
	Purge bool `form:"purge"`
}

type TaskSetShareLimitSchema struct {
	RatioLimit               float64 `json:"ratio_limit" binding:"min=-2"`
	SeedingTimeLimit         int     `json:"seeding_time_limit" binding:"min=-2"`
	InactiveSeedingTimeLimit int     `json:"inactive_seeding_time_limit" binding:"min=-2"` // -2 = use global limit, -1 = no limit, >= 0 = minutes
}

type TaskSetLocationSchema struct {
	Location string `json:"location" binding:"required"`
}

type TaskRenameSchema struct {
	NewName string `json:"new_name" binding:"required,min=1"`
}

type TaskSuperSeedingSchema struct {
	Enabled bool `json:"enabled"`
}

type TaskSetDownloadLimitSchema struct {
	Limit int `json:"limit" binding:"required,min=-2"`
}

type TaskSetUploadLimitSchema struct {
	Limit int `json:"limit" binding:"required,min=-2"`
}

type TaskSetTagsSchema struct {
	Tags []string `json:"tags" binding:"required"`
}

type TaskAddTrackersSchema struct {
	Urls []string `json:"urls" binding:"required,min=1,dive,url"`
}

type TaskEditTrackerSchema struct {
	OrigURL string `json:"orig_url" binding:"required,url"`
	NewURL  string `json:"new_url" binding:"required,url"`
}

type TaskSetCategorySchema struct {
	Category string `json:"category" binding:"required,min=1"`
}

// BulkTaskItemSchema identifies a single task inside a bulk action request.
type BulkTaskItemSchema struct {
	WorkerID string `json:"worker_id" binding:"required,uuid"`
	Hash     string `json:"hash" binding:"required"`
}

// BulkTaskActionSchema applies one action to many tasks, possibly across
// multiple workers. Hashes are grouped per worker and sent to qBittorrent in
// a single batched call (hashes separated by "|").
type BulkTaskActionSchema struct {
	Action string               `json:"action" binding:"required,oneof=stop start force_resume force_recheck force_reannounce set_category add_tags delete add_tracker remove_tracker"`
	Items  []BulkTaskItemSchema `json:"items" binding:"required,min=1,max=500,dive"`

	// Category is required when Action is "set_category" (empty string removes the category).
	Category *string `json:"category,omitempty"`
	// Tags is required (non-empty) when Action is "add_tags".
	Tags []string `json:"tags,omitempty"`
	// Purge deletes downloaded files too when Action is "delete".
	Purge bool `json:"purge,omitempty"`
	// Trackers is required (non-empty) when Action is "add_tracker" or "remove_tracker".
	Trackers []string `json:"trackers,omitempty" binding:"omitempty,dive,url"`
}
