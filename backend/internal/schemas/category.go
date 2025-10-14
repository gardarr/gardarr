package schemas

// CategoryCreateRequest represents the request body for creating a category
type CategoryCreateRequest struct {
	Name        string   `json:"name" binding:"required,min=1,max=100"`
	DefaultTags []string `json:"default_tags"`
	Directories []string `json:"directories"`
	Color       string   `json:"color" binding:"omitempty,max=50"`
	Icon        string   `json:"icon" binding:"omitempty,max=100"`
}

// CategoryUpdateRequest represents the request body for updating a category
// Note: Name and ID are immutable and cannot be updated
type CategoryUpdateRequest struct {
	DefaultTags []string `json:"default_tags"`
	Directories []string `json:"directories"`
	Color       string   `json:"color" binding:"omitempty,max=50"`
	Icon        string   `json:"icon" binding:"omitempty,max=100"`
}
