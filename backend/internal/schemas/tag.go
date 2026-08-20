package schemas

// TagCreateRequest represents the request body for creating a tag.
type TagCreateRequest struct {
	Name  string `json:"name" binding:"required,min=1,max=255"`
	Kind  string `json:"kind" binding:"omitempty,oneof=tag scope"`
	Color string `json:"color" binding:"omitempty,max=50"`
	Icon  string `json:"icon" binding:"omitempty,max=100"`
}

// TagUpdateRequest represents the request body for updating a tag.
// Note: Name, Kind and ID are immutable and cannot be updated.
type TagUpdateRequest struct {
	Color string `json:"color" binding:"omitempty,max=50"`
	Icon  string `json:"icon" binding:"omitempty,max=100"`
}
