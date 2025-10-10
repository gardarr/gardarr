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
