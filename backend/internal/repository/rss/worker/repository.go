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
// Known limitation: qBittorrent's rss/items response nests feeds inside
// folders as recursive JSON objects, but go-qbt's GetRSSFeeds decodes the
// response into a flat map[string]RSSFeed - a folder entry decodes to a
// zero-value RSSFeed and any feed nested inside it is silently dropped,
// never appearing here at all. Only feeds registered at the root are
// currently visible. Tracked upstream in jfxdev/go-qbt#11.
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

// SetRule creates or updates a rule. qBittorrent's setRule call replaces the
// whole rule definition, so updating an existing rule must first carry over
// its PreviouslyMatchedEpisodes/LastMatch - qBittorrent doesn't recompute
// them on its own, it only accumulates them as new articles match. Losing
// them on every edit would let a smart-filter rule re-match (and
// re-download) episodes it already handled.
func (r *Repository) SetRule(ruleName string, rule entities.RSSRule) error {
	existing, err := r.client.GetRSSRules()
	if err != nil {
		return err
	}

	qbtRule := withPreservedHistory(toQbtRSSRule(rule), existing[ruleName])
	return r.client.SetRSSRule(ruleName, qbtRule)
}

// withPreservedHistory copies PreviouslyMatchedEpisodes/LastMatch from
// current onto qbtRule. current is the zero qbt.RSSRule (via a missing-key
// map lookup) when ruleName doesn't exist yet, which leaves qbtRule's own
// zero values in place - exactly the clean history a brand new rule should
// start with.
func withPreservedHistory(qbtRule, current qbt.RSSRule) qbt.RSSRule {
	qbtRule.PreviouslyMatchedEpisodes = current.PreviouslyMatchedEpisodes
	qbtRule.LastMatch = current.LastMatch
	return qbtRule
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

// toQbtRSSRule converts the user-settable fields of a rule for a setRule
// call. PreviouslyMatchedEpisodes and LastMatch are deliberately left zero
// here - SetRule fills them back in from the existing rule when there is
// one, so a new rule still starts with a clean history.
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
