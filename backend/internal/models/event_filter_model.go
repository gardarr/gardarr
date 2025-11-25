package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// EventFilter represents an event filter in the database
type EventFilter struct {
	UUID            uuid.UUID `gorm:"type:uuid;primaryKey"`
	IntegrationID   uuid.UUID `gorm:"type:uuid;not null;index:idx_integration_type"`
	IntegrationType string    `gorm:"size:50;not null;index:idx_integration_type"`
	EventTypeFilter string    `gorm:"size:100"` // Single event type string
	StatusFilter    string    `gorm:"type:text"` // JSON array of strings
	CategoryFilter  string    `gorm:"type:text"` // JSON array of strings
	NameTerms       string    `gorm:"type:text"` // JSON array of strings
	CreatedAt       time.Time `gorm:"autoCreateTime"`
	UpdatedAt       time.Time `gorm:"autoUpdateTime"`
}

// TableName overrides the table name used by EventFilter
func (EventFilter) TableName() string {
	return "event_filters"
}

func (ef *EventFilter) BeforeCreate(tx *gorm.DB) (err error) {
	if ef.UUID == uuid.Nil {
		ef.UUID = uuid.New()
	}
	ef.CreatedAt = time.Now()
	return
}

func (ef *EventFilter) BeforeUpdate(tx *gorm.DB) (err error) {
	ef.UpdatedAt = time.Now()
	return
}

// EventFilterResponse represents the response body for event filter operations
type EventFilterResponse struct {
	UUID            string    `json:"uuid"`
	IntegrationID   string    `json:"integration_id"`
	IntegrationType string    `json:"integration_type"`
	EventTypeFilter string    `json:"event_type_filter,omitempty"`
	StatusFilter    []string  `json:"status_filter,omitempty"`
	CategoryFilter  []string  `json:"category_filter,omitempty"`
	NameTerms       []string  `json:"name_terms,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

