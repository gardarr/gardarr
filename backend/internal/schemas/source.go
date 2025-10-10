package schemas

type SourceCreateSchema struct {
	Name string `json:"name" binding:"required"`
	URL  string `json:"url" binding:"required"`
	Type string `json:"type" binding:"required"`
}

type SourceGetSchema struct {
	ID string `uri:"id" binding:"required,uuid"`
}
