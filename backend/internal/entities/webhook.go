package entities

import (
	"time"

	"github.com/google/uuid"
)

// Webhook represents a registered webhook endpoint
type Webhook struct {
	UUID               uuid.UUID
	URL                string
	InsecureSkipVerify bool
	Enabled            bool
	TimeoutSeconds     int
	Filter             *EventFilter // Optional event filter for this webhook (1:1 relationship)
	CreatedAt          time.Time
	UpdatedAt          time.Time
}
