package rss

import (
	"reflect"
	"testing"

	"github.com/jfxdev/gardarr/internal/entities"
	"github.com/jfxdev/go-qbt"
)

func TestToRSSFeed(t *testing.T) {
	t.Parallel()

	item := qbt.RSSFeed{
		URL:       "https://example.com/feed",
		Title:     "Example",
		LastBuild: "2026-08-23",
		IsLoading: true,
		HasError:  false,
		Articles: []qbt.RSSArticle{
			{ID: "1", Title: "Article 1", Summary: "s1", Link: "l1", IsRead: false},
		},
	}

	got := toRSSFeed("Movies\\Example", item)

	want := &entities.RSSFeed{
		Path:      "Movies\\Example",
		URL:       "https://example.com/feed",
		Title:     "Example",
		LastBuild: "2026-08-23",
		IsLoading: true,
		HasError:  false,
		Articles: []entities.RSSArticle{
			{ID: "1", Title: "Article 1", Summary: "s1", Link: "l1", IsRead: false},
		},
	}

	if !reflect.DeepEqual(got, want) {
		t.Fatalf("toRSSFeed() = %+v, want %+v", got, want)
	}
}

func TestToRSSRule(t *testing.T) {
	t.Parallel()

	rule := qbt.RSSRule{
		Enabled:        true,
		MustContain:    "1080p",
		MustNotContain: "CAM",
		UseRegex:       false,
		AffectedFeeds:  []string{"https://example.com/feed"},
		IgnoreDays:     7,
		AddPaused:      true,
	}

	got := toRSSRule("my-rule", rule)

	if got.Name != "my-rule" || got.MustContain != "1080p" || got.IgnoreDays != 7 || !got.AddPaused {
		t.Fatalf("toRSSRule() mismatch: %+v", got)
	}
}

// toQbtRSSRule must never round-trip PreviouslyMatchedEpisodes/LastMatch:
// those are server-maintained state, not something a save should overwrite.
func TestToQbtRSSRule_OmitsServerManagedFields(t *testing.T) {
	t.Parallel()

	rule := entities.RSSRule{
		Enabled:                   true,
		MustContain:               "1080p",
		PreviouslyMatchedEpisodes: []string{"S01E01"},
		LastMatch:                 "2026-08-20",
		AffectedFeeds:             []string{"https://example.com/feed"},
	}

	got := toQbtRSSRule(rule)

	if got.PreviouslyMatchedEpisodes != nil {
		t.Fatalf("expected PreviouslyMatchedEpisodes to be omitted, got %v", got.PreviouslyMatchedEpisodes)
	}
	if got.LastMatch != "" {
		t.Fatalf("expected LastMatch to be omitted, got %q", got.LastMatch)
	}
	if got.MustContain != "1080p" || !got.Enabled {
		t.Fatalf("expected user-settable fields to be preserved, got %+v", got)
	}
}
