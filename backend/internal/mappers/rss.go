package mappers

import (
	"sort"

	"github.com/google/uuid"
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

	var workerID string
	if e.WorkerID != uuid.Nil {
		workerID = e.WorkerID.String()
	}

	return models.RSSFeedResponse{
		Path:      e.Path,
		URL:       e.URL,
		Title:     e.Title,
		LastBuild: e.LastBuild,
		IsLoading: e.IsLoading,
		HasError:  e.HasError,
		Articles:  articles,
		WorkerID:  workerID,
	}
}

// ToRSSFeedListResponse converts a cross-instance feed list (already tagged
// with WorkerID) into a slice sorted by (WorkerID, Path), so the API
// response has a deterministic order.
func ToRSSFeedListResponse(feeds []*entities.RSSFeed) []models.RSSFeedResponse {
	sorted := make([]*entities.RSSFeed, len(feeds))
	copy(sorted, feeds)
	sort.Slice(sorted, func(i, j int) bool {
		if sorted[i].WorkerID != sorted[j].WorkerID {
			return sorted[i].WorkerID.String() < sorted[j].WorkerID.String()
		}
		return sorted[i].Path < sorted[j].Path
	})

	response := make([]models.RSSFeedResponse, len(sorted))
	for i, feed := range sorted {
		response[i] = ToRSSFeedResponse(feed)
	}

	return response
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

	var workerID string
	if e.WorkerID != uuid.Nil {
		workerID = e.WorkerID.String()
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
		WorkerID:                  workerID,
	}
}

// ToRSSRuleListResponse converts a cross-instance rule list (already tagged
// with WorkerID) into a slice sorted by (WorkerID, Name), so the API
// response has a deterministic order.
func ToRSSRuleListResponse(rules []*entities.RSSRule) []models.RSSRuleResponse {
	sorted := make([]*entities.RSSRule, len(rules))
	copy(sorted, rules)
	sort.Slice(sorted, func(i, j int) bool {
		if sorted[i].WorkerID != sorted[j].WorkerID {
			return sorted[i].WorkerID.String() < sorted[j].WorkerID.String()
		}
		return sorted[i].Name < sorted[j].Name
	})

	response := make([]models.RSSRuleResponse, len(sorted))
	for i, rule := range sorted {
		response[i] = ToRSSRuleResponse(rule)
	}

	return response
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
