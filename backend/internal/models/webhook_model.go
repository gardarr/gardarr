package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Webhook represents a webhook in the database
type Webhook struct {
	UUID               uuid.UUID `gorm:"type:uuid;primaryKey"`
	URL                string    `gorm:"size:512;not null"`
	InsecureSkipVerify bool      `gorm:"not null"`
	Enabled            bool      `gorm:"not null"`
	TimeoutSeconds     int       `gorm:"not null;default:10"`
	CreatedAt          time.Time `gorm:"autoCreateTime"`
	UpdatedAt          time.Time `gorm:"autoUpdateTime"`
}

// TableName overrides the table name used by Webhook
func (Webhook) TableName() string {
	return "integration_webhooks"
}

func (w *Webhook) BeforeCreate(tx *gorm.DB) (err error) {
	if w.UUID == uuid.Nil {
		w.UUID = uuid.New()
	}
	w.CreatedAt = time.Now()
	return
}

func (w *Webhook) BeforeUpdate(tx *gorm.DB) (err error) {
	w.UpdatedAt = time.Now()
	return
}

// WebhookResponse represents the response body for webhook operations
type WebhookResponse struct {
	UUID               string               `json:"uuid"`
	URL                string               `json:"url"`
	InsecureSkipVerify bool                 `json:"insecure_skip_verify"`
	Enabled            bool                 `json:"enabled"`
	TimeoutSeconds     int                  `json:"timeout_seconds"`
	Filter             *EventFilterResponse `json:"filter,omitempty"`
	CreatedAt          time.Time            `json:"created_at"`
	UpdatedAt          time.Time            `json:"updated_at"`
}
