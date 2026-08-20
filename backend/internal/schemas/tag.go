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

// TagRenameRequest represents the request body for renaming a tag.
type TagRenameRequest struct {
	From string `json:"from" binding:"required,min=1,max=255"`
	To   string `json:"to" binding:"required,min=1,max=255"`
}

// TagMergeRequest represents the request body for merging tags into one.
type TagMergeRequest struct {
	Sources []string `json:"sources" binding:"required,min=1,dive,required,max=255"`
	Target  string   `json:"target" binding:"required,min=1,max=255"`
}

// TagDeriveRequest represents the request body for deriving new tags that
// reuse one side of source's separator (prefix or suffix, per Mode) while
// varying the other across values. Delimiter is only required when source
// has no built-in separator (":" / "::") - see tagrules.Derive.
type TagDeriveRequest struct {
	Source    string   `json:"source" binding:"required,min=1,max=255"`
	Delimiter string   `json:"delimiter" binding:"omitempty,max=10"`
	Values    []string `json:"values" binding:"required,min=1,dive,required,max=255"`
	Mode      string   `json:"mode" binding:"omitempty,oneof=prefix suffix"`
	Kind      string   `json:"kind" binding:"omitempty,oneof=tag scope"`
	Color     string   `json:"color" binding:"omitempty,max=50"`
	Icon      string   `json:"icon" binding:"omitempty,max=100"`
}
