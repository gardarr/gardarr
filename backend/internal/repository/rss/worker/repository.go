// Package rss wraps go-qbt's RSS endpoints for a single qBittorrent
// instance and maps its types onto Gardarr's entities. It intentionally has
// no polling loop and no matching logic: qBittorrent owns feed refresh and
// rule evaluation, Gardarr only reads and manages that state.
package rss

import (
	"github.com/jfxdev/gardarr/internal/entities"
	"github.com/jfxdev/go-qbt"
)

type Repository struct {
	client *qbt.Client
}

func New(client *qbt.Client) *Repository {
	return &Repository{client: client}
}

// ListFeeds returns every configured feed, keyed by its qBittorrent path.
// Note: qBittorrent's rss/items response nests feeds inside folders; a feed
// living inside a folder is still returned as a top-level path entry, but
// folders themselves don't currently decode into meaningful RSSFeed data
// (go-qbt's RSSFeed type models a leaf feed, not a folder).
func (r *Repository) ListFeeds(withData bool) (map[string]*entities.RSSFeed, error) {
	items, err := r.client.GetRSSFeeds(withData)
	if err != nil {
		return nil, err
	}

	result := make(map[string]*entities.RSSFeed, len(items))
	for path, item := range items {
		result[path] = toRSSFeed(path, item)
	}

	return result, nil
}

func (r *Repository) AddFeed(feedURL, path string) error {
	return r.client.AddRSSFeed(feedURL, path)
}

func (r *Repository) RemoveFeed(path string) error {
	return r.client.RemoveRSSFeed(path)
}

func (r *Repository) SetFeedURL(path, feedURL string) error {
	return r.client.SetRSSFeedURL(path, feedURL)
}

func (r *Repository) AddFolder(path string) error {
	return r.client.AddRSSFolder(path)
}

func (r *Repository) MoveItem(itemPath, destPath string) error {
	return r.client.MoveRSSItem(itemPath, destPath)
}

func (r *Repository) RefreshItem(itemPath string) error {
	return r.client.RefreshRSSItem(itemPath)
}

func (r *Repository) MarkAsRead(itemPath, articleID string) error {
	return r.client.MarkRSSItemAsRead(itemPath, articleID)
}

// ListRules returns every auto-downloading rule, keyed by rule name.
func (r *Repository) ListRules() (map[string]*entities.RSSRule, error) {
	rules, err := r.client.GetRSSRules()
	if err != nil {
		return nil, err
	}

	result := make(map[string]*entities.RSSRule, len(rules))
	for name, rule := range rules {
		result[name] = toRSSRule(name, rule)
	}

	return result, nil
}

func (r *Repository) SetRule(ruleName string, rule entities.RSSRule) error {
	return r.client.SetRSSRule(ruleName, toQbtRSSRule(rule))
}

func (r *Repository) RenameRule(ruleName, newRuleName string) error {
	return r.client.RenameRSSRule(ruleName, newRuleName)
}

func (r *Repository) RemoveRule(ruleName string) error {
	return r.client.RemoveRSSRule(ruleName)
}

// MatchingArticles previews which articles a rule would currently match,
// grouped by feed name - lets a caller test a rule before saving it.
func (r *Repository) MatchingArticles(ruleName string) (map[string][]string, error) {
	return r.client.GetMatchingRSSArticles(ruleName)
}

func toRSSFeed(path string, item qbt.RSSFeed) *entities.RSSFeed {
	articles := make([]entities.RSSArticle, len(item.Articles))
	for i, a := range item.Articles {
		articles[i] = entities.RSSArticle{
			ID:      a.ID,
			Title:   a.Title,
			Summary: a.Summary,
			Link:    a.Link,
			IsRead:  a.IsRead,
		}
	}

	return &entities.RSSFeed{
		Path:      path,
		URL:       item.URL,
		Title:     item.Title,
		LastBuild: item.LastBuild,
		IsLoading: item.IsLoading,
		HasError:  item.HasError,
		Articles:  articles,
	}
}

func toRSSRule(name string, rule qbt.RSSRule) *entities.RSSRule {
	return &entities.RSSRule{
		Name:                      name,
		Enabled:                   rule.Enabled,
		MustContain:               rule.MustContain,
		MustNotContain:            rule.MustNotContain,
		UseRegex:                  rule.UseRegex,
		EpisodeFilter:             rule.EpisodeFilter,
		SmartFilter:               rule.SmartFilter,
		PreviouslyMatchedEpisodes: rule.PreviouslyMatchedEpisodes,
		AffectedFeeds:             rule.AffectedFeeds,
		IgnoreDays:                rule.IgnoreDays,
		LastMatch:                 rule.LastMatch,
		AddPaused:                 rule.AddPaused,
		AssignedCategory:          rule.AssignedCategory,
		SavePath:                  rule.SavePath,
		TorrentContentLayout:      rule.TorrentContentLayout,
	}
}

// toQbtRSSRule converts a rule for a setRule call. PreviouslyMatchedEpisodes
// and LastMatch are omitted: they're server-maintained state qBittorrent
// recomputes itself as the rule matches new articles over time.
func toQbtRSSRule(rule entities.RSSRule) qbt.RSSRule {
	return qbt.RSSRule{
		Enabled:              rule.Enabled,
		MustContain:          rule.MustContain,
		MustNotContain:       rule.MustNotContain,
		UseRegex:             rule.UseRegex,
		EpisodeFilter:        rule.EpisodeFilter,
		SmartFilter:          rule.SmartFilter,
		AffectedFeeds:        rule.AffectedFeeds,
		IgnoreDays:           rule.IgnoreDays,
		AddPaused:            rule.AddPaused,
		AssignedCategory:     rule.AssignedCategory,
		SavePath:             rule.SavePath,
		TorrentContentLayout: rule.TorrentContentLayout,
	}
}
