package models

type RSSFeedResponse struct {
	Path      string               `json:"path"`
	URL       string               `json:"url,omitempty"`
	Title     string               `json:"title"`
	LastBuild string               `json:"last_build,omitempty"`
	IsLoading bool                 `json:"is_loading"`
	HasError  bool                 `json:"has_error"`
	Articles  []RSSArticleResponse `json:"articles,omitempty"`
}

type RSSArticleResponse struct {
	ID      string `json:"id"`
	Title   string `json:"title"`
	Summary string `json:"summary,omitempty"`
	Link    string `json:"link,omitempty"`
	IsRead  bool   `json:"is_read"`
}

type RSSRuleResponse struct {
	Name                      string   `json:"name"`
	Enabled                   bool     `json:"enabled"`
	MustContain               string   `json:"must_contain"`
	MustNotContain            string   `json:"must_not_contain"`
	UseRegex                  bool     `json:"use_regex"`
	EpisodeFilter             string   `json:"episode_filter,omitempty"`
	SmartFilter               bool     `json:"smart_filter"`
	PreviouslyMatchedEpisodes []string `json:"previously_matched_episodes,omitempty"`
	AffectedFeeds             []string `json:"affected_feeds,omitempty"`
	IgnoreDays                int      `json:"ignore_days"`
	LastMatch                 string   `json:"last_match,omitempty"`
	AddPaused                 bool     `json:"add_paused"`
	AssignedCategory          string   `json:"assigned_category,omitempty"`
	SavePath                  string   `json:"save_path,omitempty"`
	TorrentContentLayout      string   `json:"torrent_content_layout,omitempty"`
}
