package entities

// RSSFeed represents an RSS feed registered on a qBittorrent instance,
// addressed by its Path (folder-qualified, e.g. "Movies\1080p"). qBittorrent
// itself owns polling and article storage; Gardarr only reads and manages
// this state through the WebUI API.
type RSSFeed struct {
	Path      string
	URL       string
	Title     string
	LastBuild string
	IsLoading bool
	HasError  bool
	Articles  []RSSArticle
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
}
