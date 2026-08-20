package entities

import "time"

type TagKind string

const (
	TagKindTag   TagKind = "tag"
	TagKindScope TagKind = "scope"
)

type Tag struct {
	ID    string
	Name  string
	Kind  TagKind
	Color string
	Icon  string
	// UsageCount is computed live from workers by Service.ListTags and is
	// never persisted; it is 0 on entities returned by the repository.
	UsageCount int
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

// ScopeConflict is one torrent holding more than one value for the same
// exclusive scope (e.g. "quality::4k" and "quality::1080p" together) -
// invalid under the scoped-tag rules, but pre-existing data is reported
// rather than silently reconciled.
type ScopeConflict struct {
	WorkerID string   `json:"worker_id"`
	TaskHash string   `json:"task_hash"`
	TaskName string   `json:"task_name"`
	Scope    string   `json:"scope"`
	Tags     []string `json:"tags"`
}

// TagConflictReport summarizes backward-compatibility issues the
// scoped-tag rules introduce for tags that predate them.
type TagConflictReport struct {
	ScopeConflicts []ScopeConflict `json:"scope_conflicts"`
	// GroupedTags lists every distinct tag observed on any worker that
	// uses a single ":" (grouped semantics). "::" already had a rendering
	// meaning, but a single ":" is new - a tag like "S01:E02" that was
	// never intended as composite starts rendering and filtering
	// differently, so it's worth a look before relying on it.
	GroupedTags []string `json:"grouped_tags"`
}
