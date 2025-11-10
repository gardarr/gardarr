package entities

import (
	"time"

	"github.com/google/uuid"
)

// Event represents a system event
type Event struct {
	UUID      uuid.UUID
	AgentID   uuid.UUID
	Type      string
	TaskHash  string
	OldValue  string
	NewValue  string
	Metadata  map[string]interface{}
	CreatedAt time.Time
}
