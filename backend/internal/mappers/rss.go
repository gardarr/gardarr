package mappers

import (
	"sort"

	"github.com/jfxdev/gardarr/internal/entities"
	"github.com/jfxdev/gardarr/internal/models"
)

func ToRSSFeedResponse(e *entities.RSSFeed) models.RSSFeedResponse {
	if e == nil {
		return models.RSSFeedResponse{}
	}

	articles := make([]models.RSSArticleResponse, len(e.Articles))
	for i, a := range e.Articles {
		articles[i] = models.RSSArticleResponse{
			ID:      a.ID,
			Title:   a.Title,
			Summary: a.Summary,
			Link:    a.Link,
			IsRead:  a.IsRead,
		}
	}

	return models.RSSFeedResponse{
		Path:      e.Path,
		URL:       e.URL,
		Title:     e.Title,
		LastBuild: e.LastBuild,
		IsLoading: e.IsLoading,
		HasError:  e.HasError,
		Articles:  articles,
	}
}

// ToRSSFeedsResponse converts a path-keyed feed map into a slice sorted by
// path, so the API response has a deterministic order.
func ToRSSFeedsResponse(feeds map[string]*entities.RSSFeed) []models.RSSFeedResponse {
	paths := make([]string, 0, len(feeds))
	for path := range feeds {
		paths = append(paths, path)
	}
	sort.Strings(paths)

	response := make([]models.RSSFeedResponse, len(paths))
	for i, path := range paths {
		response[i] = ToRSSFeedResponse(feeds[path])
	}

	return response
}

func ToRSSRuleResponse(e *entities.RSSRule) models.RSSRuleResponse {
	if e == nil {
		return models.RSSRuleResponse{}
	}

	return models.RSSRuleResponse{
		Name:                      e.Name,
		Enabled:                   e.Enabled,
		MustContain:               e.MustContain,
		MustNotContain:            e.MustNotContain,
		UseRegex:                  e.UseRegex,
		EpisodeFilter:             e.EpisodeFilter,
		SmartFilter:               e.SmartFilter,
		PreviouslyMatchedEpisodes: e.PreviouslyMatchedEpisodes,
		AffectedFeeds:             e.AffectedFeeds,
		IgnoreDays:                e.IgnoreDays,
		LastMatch:                 e.LastMatch,
		AddPaused:                 e.AddPaused,
		AssignedCategory:          e.AssignedCategory,
		SavePath:                  e.SavePath,
		TorrentContentLayout:      e.TorrentContentLayout,
	}
}

// ToRSSRulesResponse converts a name-keyed rule map into a slice sorted by
// name, so the API response has a deterministic order.
func ToRSSRulesResponse(rules map[string]*entities.RSSRule) []models.RSSRuleResponse {
	names := make([]string, 0, len(rules))
	for name := range rules {
		names = append(names, name)
	}
	sort.Strings(names)

	response := make([]models.RSSRuleResponse, len(names))
	for i, name := range names {
		response[i] = ToRSSRuleResponse(rules[name])
	}

	return response
}
