package entities

import (
	"time"

	"github.com/google/uuid"
)

// EventFilterType represents the type of integration that owns the filter
type EventFilterType string

const (
	EventFilterTypeWebhook EventFilterType = "webhook"
	// Future types: EventFilterTypeDiscord, EventFilterTypeSlack, etc.
)

// EventFilter represents filtering criteria for events in integrations
type EventFilter struct {
	UUID            uuid.UUID
	IntegrationID   uuid.UUID       // The UUID of the webhook, discord integration, etc.
	IntegrationType EventFilterType // Type of integration (webhook, discord, slack, etc.)
	EventTypeFilter string          // Filter by event type (torrent.added, torrent.completed, etc.) - empty means all types
	StatusFilter    []string        // Filter by new_value (status) - empty means all statuses
	CategoryFilter  []string        // Filter by category from metadata - empty means all categories
	NameTerms       []string        // Filter by terms in task name - empty means all names
	CreatedAt       time.Time
	UpdatedAt       time.Time
}
