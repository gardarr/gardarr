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
