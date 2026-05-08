package entities

import (
	"time"

	"github.com/google/uuid"
)

// Event represents a system event
type Event struct {
	UUID      uuid.UUID
	WorkerID  uuid.UUID
	Type      string
	TaskHash  string
	OldValue  string
	NewValue  string
	Metadata  map[string]interface{} // Contains all task details and event-specific data
	CreatedAt time.Time
}

// TaskState represents the last known state of a task
type TaskState struct {
	WorkerID  uuid.UUID
	Hash      string
	State     string
	Progress  float64
	UpdatedAt time.Time
}
