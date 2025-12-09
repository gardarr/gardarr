package entities

import (
	"time"

	"github.com/google/uuid"
)

// WebhookHistory represents a webhook delivery attempt record
type WebhookHistory struct {
	UUID         uuid.UUID
	WebhookID    uuid.UUID
	TaskHash     string
	TaskName     string
	TaskStatus   string
	StatusCode   int
	ResponseBody string
	RequestBody  string
	Error        string
	CreatedAt    time.Time
}
