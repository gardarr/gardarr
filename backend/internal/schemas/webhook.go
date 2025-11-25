package schemas

// EventFilterRequest represents the request body for creating/updating an event filter
type EventFilterRequest struct {
	EventTypeFilter string   `json:"event_type_filter,omitempty"`
	StatusFilter    []string `json:"status_filter,omitempty"`
	CategoryFilter  []string `json:"category_filter,omitempty"`
	NameTerms       []string `json:"name_terms,omitempty"`
}

// WebhookCreateRequest represents the request body for creating a webhook
type WebhookCreateRequest struct {
	URL                string              `json:"url" binding:"required,url"`
	InsecureSkipVerify bool                `json:"insecure_skip_verify"`
	TimeoutSeconds     int                 `json:"timeout_seconds" binding:"omitempty,min=1,max=300"`
	Filter             *EventFilterRequest `json:"filter,omitempty"`
}

// WebhookUpdateRequest represents the request body for updating a webhook
type WebhookUpdateRequest struct {
	URL                *string             `json:"url" binding:"omitempty,url"`
	InsecureSkipVerify *bool               `json:"insecure_skip_verify"`
	Enabled            *bool               `json:"enabled"`
	TimeoutSeconds     *int                `json:"timeout_seconds" binding:"omitempty,min=1,max=300"`
	Filter             *EventFilterRequest `json:"filter,omitempty"`
}
