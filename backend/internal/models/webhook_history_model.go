package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// WebhookHistory represents a webhook delivery attempt in the database
type WebhookHistory struct {
	UUID         uuid.UUID `gorm:"type:uuid;primaryKey"`
	WebhookID    uuid.UUID `gorm:"type:uuid;not null;index:idx_webhook_history_webhook_id"`
	TaskHash     string    `gorm:"size:64;not null;index:idx_webhook_history_task_hash"`
	TaskName     string    `gorm:"size:512;not null"`
	TaskStatus   string    `gorm:"size:64;not null"`
	StatusCode   int       `gorm:"not null"`
	ResponseBody string    `gorm:"type:text"`
	RequestBody  string    `gorm:"type:text"`
	Error        string    `gorm:"type:text"`
	CreatedAt    time.Time `gorm:"autoCreateTime;index:idx_webhook_history_created_at"`
}

// TableName overrides the table name used by WebhookHistory
func (WebhookHistory) TableName() string {
	return "integrations_webhook_history"
}

func (w *WebhookHistory) BeforeCreate(tx *gorm.DB) (err error) {
	if w.UUID == uuid.Nil {
		w.UUID = uuid.New()
	}
	w.CreatedAt = time.Now()
	return
}

// WebhookHistoryResponse represents the response body for webhook history operations
type WebhookHistoryResponse struct {
	UUID         string    `json:"uuid"`
	WebhookID    string    `json:"webhook_id"`
	TaskHash     string    `json:"task_hash"`
	TaskName     string    `json:"task_name"`
	TaskStatus   string    `json:"task_status"`
	StatusCode   int       `json:"status_code"`
	ResponseBody string    `json:"response_body,omitempty"`
	RequestBody  string    `json:"request_body,omitempty"`
	Error        string    `json:"error,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
}
