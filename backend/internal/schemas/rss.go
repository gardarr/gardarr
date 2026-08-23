package schemas

// RSSAddFeedSchema adds a feed at Path (folder-qualified, e.g.
// "Movies\1080p"); an empty Path adds it at the root.
type RSSAddFeedSchema struct {
	URL  string `json:"url" binding:"required"`
	Path string `json:"path"`
}

type RSSRemoveFeedSchema struct {
	Path string `json:"path" binding:"required"`
}

type RSSSetFeedURLSchema struct {
	Path string `json:"path" binding:"required"`
	URL  string `json:"url" binding:"required"`
}

type RSSAddFolderSchema struct {
	Path string `json:"path" binding:"required"`
}

// RSSMoveItemSchema moves or renames a feed/folder: MoveRSSItem in
// go-qbt is qBittorrent's single endpoint for both operations.
type RSSMoveItemSchema struct {
	ItemPath string `json:"item_path" binding:"required"`
	DestPath string `json:"dest_path" binding:"required"`
}

type RSSRefreshItemSchema struct {
	ItemPath string `json:"item_path" binding:"required"`
}

// RSSMarkAsReadSchema marks a single article read, or the whole feed when
// ArticleID is empty.
type RSSMarkAsReadSchema struct {
	ItemPath  string `json:"item_path" binding:"required"`
	ArticleID string `json:"article_id"`
}

// RSSSetRuleSchema is a rule definition for create/update. PreviouslyMatchedEpisodes
// and LastMatch are excluded - they're state qBittorrent maintains itself.
type RSSSetRuleSchema struct {
	Enabled              bool     `json:"enabled"`
	MustContain          string   `json:"must_contain"`
	MustNotContain       string   `json:"must_not_contain"`
	UseRegex             bool     `json:"use_regex"`
	EpisodeFilter        string   `json:"episode_filter"`
	SmartFilter          bool     `json:"smart_filter"`
	AffectedFeeds        []string `json:"affected_feeds"`
	IgnoreDays           int      `json:"ignore_days"`
	AddPaused            bool     `json:"add_paused"`
	AssignedCategory     string   `json:"assigned_category"`
	SavePath             string   `json:"save_path"`
	TorrentContentLayout string   `json:"torrent_content_layout"`
}

type RSSRenameRuleSchema struct {
	NewRuleName string `json:"new_rule_name" binding:"required"`
}
