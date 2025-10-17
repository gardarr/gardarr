package schemas

type TaskCreateSchema struct {
	MagnetURI string   `json:"magnet_uri" binding:"required"`
	Category  string   `json:"category" binding:"required"`
	Directory string   `json:"directory"`
	Tags      []string `json:"tags" binding:"required"`
}

type TaskDeleteSchema struct {
	ID string `uri:"id" binding:"required"`
}

type TaskDeleteOptionsSchema struct {
	Purge bool `form:"purge"`
}

type TaskSetShareLimitSchema struct {
	Hash             string  `json:"hash" binding:"required"`
	RatioLimit       float64 `json:"ratio_limit" binding:"required,min=0"`
	SeedingTimeLimit int     `json:"seeding_time_limit" binding:"required,min=0"`
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
