package entities

import "github.com/google/uuid"

// RSSFeed represents an RSS feed registered on a qBittorrent instance,
// addressed by its Path (folder-qualified, e.g. "Movies\1080p"). qBittorrent
// itself owns polling and article storage; Gardarr only reads and manages
// this state through the WebUI API. WorkerID is set by workermanager.Service
// (zero-valued when a caller already knows the worker, e.g. a single-worker
// repository call) so a feed can be identified in a cross-instance listing.
type RSSFeed struct {
	Path      string
	URL       string
	Title     string
	LastBuild string
	IsLoading bool
	HasError  bool
	Articles  []RSSArticle
	WorkerID  uuid.UUID
}

// RSSArticle is a single item within an RSS feed.
type RSSArticle struct {
	ID      string
	Title   string
	Summary string
	Link    string
	IsRead  bool
}

// RSSRule represents a qBittorrent RSS auto-downloading rule: the actual
// automation engine behind RSS in qBittorrent. Gardarr manages rule
// definitions but never evaluates or triggers them itself - matching and
// downloading stay entirely on the qBittorrent side.
type RSSRule struct {
	Name                      string
	Enabled                   bool
	MustContain               string
	MustNotContain            string
	UseRegex                  bool
	EpisodeFilter             string
	SmartFilter               bool
	PreviouslyMatchedEpisodes []string
	AffectedFeeds             []string
	IgnoreDays                int
	LastMatch                 string
	AddPaused                 bool
	AssignedCategory          string
	SavePath                  string
	TorrentContentLayout      string
	WorkerID                  uuid.UUID
}

// RSSFeedListResult aggregates feeds across every worker, mirroring
// TaskListResult: partial per-worker failures don't fail the whole read.
type RSSFeedListResult struct {
	Feeds  []*RSSFeed
	Errors map[string]string // WorkerUUID -> ErrorMessage
}

// RSSRuleListResult aggregates rules across every worker, mirroring
// TaskListResult.
type RSSRuleListResult struct {
	Rules  []*RSSRule
	Errors map[string]string // WorkerUUID -> ErrorMessage
}
