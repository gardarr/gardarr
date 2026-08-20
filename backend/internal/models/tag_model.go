package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// TagKind distinguishes a plain/value tag row from a scope row. A scope row
// (e.g. name "quality") carries the color shared by every "quality::*"
// tag; a tag row is an individual tag name as it appears on qBittorrent
// (e.g. "movies", "quality::4k").
type TagKind string

const (
	TagKindTag   TagKind = "tag"
	TagKindScope TagKind = "scope"
)

// Tag is Gardarr's local enrichment of a qBittorrent tag: color and icon.
// It is never the source of truth for a tag's existence - tags observed on
// a worker but absent here must still be usable, mirroring how Category
// relates to qBittorrent categories.
type Tag struct {
	ID        string    `gorm:"type:varchar(100);primaryKey"`
	Name      string    `gorm:"size:255;not null;uniqueIndex:idx_tags_kind_name"`
	Kind      TagKind   `gorm:"size:20;not null;default:'tag';uniqueIndex:idx_tags_kind_name"`
	Color     string    `gorm:"size:50"`
	Icon      string    `gorm:"size:100"`
	CreatedAt time.Time `gorm:"autoCreateTime"`
	UpdatedAt time.Time `gorm:"autoUpdateTime"`
}

func (t *Tag) BeforeCreate(tx *gorm.DB) (err error) {
	t.CreatedAt = time.Now()
	if t.ID == "" {
		t.ID = uuid.New().String()
	}
	if t.Kind == "" {
		t.Kind = TagKindTag
	}

	return
}

func (t *Tag) BeforeUpdate(tx *gorm.DB) (err error) {
	t.UpdatedAt = time.Now()
	return
}

// TagResponse represents the response body for tag operations. UsageCount
// is computed live from workers at list time and is never persisted.
type TagResponse struct {
	ID         string    `json:"id"`
	Name       string    `json:"name"`
	Kind       TagKind   `json:"kind"`
	Color      string    `json:"color,omitempty"`
	Icon       string    `json:"icon,omitempty"`
	UsageCount int       `json:"usage_count"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}
