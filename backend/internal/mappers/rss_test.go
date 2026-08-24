package mappers

import (
	"testing"

	"github.com/google/uuid"
	"github.com/jfxdev/gardarr/internal/entities"
)

func TestToRSSFeedResponse_Nil(t *testing.T) {
	t.Parallel()

	got := ToRSSFeedResponse(nil)
	if got.Path != "" || got.Title != "" || len(got.Articles) != 0 {
		t.Fatalf("expected zero-value response for nil feed, got %+v", got)
	}
}

func TestToRSSFeedsResponse_SortedByPath(t *testing.T) {
	t.Parallel()

	feeds := map[string]*entities.RSSFeed{
		"Movies\\1080p": {Path: "Movies\\1080p", Title: "1080p"},
		"Anime":         {Path: "Anime", Title: "Anime"},
		"Movies\\4k":    {Path: "Movies\\4k", Title: "4k"},
	}

	got := ToRSSFeedsResponse(feeds)
	if len(got) != 3 {
		t.Fatalf("expected 3 feeds, got %d", len(got))
	}

	wantOrder := []string{"Anime", "Movies\\1080p", "Movies\\4k"}
	for i, path := range wantOrder {
		if got[i].Path != path {
			t.Fatalf("position %d: got path %q, want %q", i, got[i].Path, path)
		}
	}
}

func TestToRSSRuleResponse_Nil(t *testing.T) {
	t.Parallel()

	got := ToRSSRuleResponse(nil)
	if got.Name != "" || got.Enabled {
		t.Fatalf("expected zero-value response for nil rule, got %+v", got)
	}
}

func TestToRSSRulesResponse_SortedByName(t *testing.T) {
	t.Parallel()

	rules := map[string]*entities.RSSRule{
		"zulu":  {Name: "zulu", Enabled: true},
		"alpha": {Name: "alpha", Enabled: false},
	}

	got := ToRSSRulesResponse(rules)
	if len(got) != 2 {
		t.Fatalf("expected 2 rules, got %d", len(got))
	}
	if got[0].Name != "alpha" || got[1].Name != "zulu" {
		t.Fatalf("expected alphabetical order, got %q then %q", got[0].Name, got[1].Name)
	}
}

func TestToRSSFeedResponse_MapsArticles(t *testing.T) {
	t.Parallel()

	feed := &entities.RSSFeed{
		Path:  "Anime",
		Title: "Anime",
		Articles: []entities.RSSArticle{
			{ID: "1", Title: "Episode 1", IsRead: false},
			{ID: "2", Title: "Episode 2", IsRead: true},
		},
	}

	got := ToRSSFeedResponse(feed)
	if len(got.Articles) != 2 {
		t.Fatalf("expected 2 articles, got %d", len(got.Articles))
	}
	if got.Articles[0].ID != "1" || got.Articles[1].IsRead != true {
		t.Fatalf("articles not mapped correctly: %+v", got.Articles)
	}
}

func TestToRSSFeedResponse_WorkerID(t *testing.T) {
	t.Parallel()

	if got := ToRSSFeedResponse(&entities.RSSFeed{Path: "Anime"}); got.WorkerID != "" {
		t.Fatalf("expected empty worker_id for a zero UUID, got %q", got.WorkerID)
	}

	workerID := uuid.New()
	got := ToRSSFeedResponse(&entities.RSSFeed{Path: "Anime", WorkerID: workerID})
	if got.WorkerID != workerID.String() {
		t.Fatalf("got worker_id %q, want %q", got.WorkerID, workerID.String())
	}
}

func TestToRSSFeedListResponse_SortedByWorkerThenPath(t *testing.T) {
	t.Parallel()

	workerA := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	workerB := uuid.MustParse("00000000-0000-0000-0000-000000000002")

	feeds := []*entities.RSSFeed{
		{Path: "Zulu", WorkerID: workerB},
		{Path: "Bravo", WorkerID: workerA},
		{Path: "Alpha", WorkerID: workerA},
	}

	got := ToRSSFeedListResponse(feeds)
	if len(got) != 3 {
		t.Fatalf("expected 3 feeds, got %d", len(got))
	}

	wantOrder := []string{"Alpha", "Bravo", "Zulu"}
	for i, path := range wantOrder {
		if got[i].Path != path {
			t.Fatalf("position %d: got path %q, want %q", i, got[i].Path, path)
		}
	}
}

func TestToRSSRuleListResponse_SortedByWorkerThenName(t *testing.T) {
	t.Parallel()

	workerA := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	workerB := uuid.MustParse("00000000-0000-0000-0000-000000000002")

	rules := []*entities.RSSRule{
		{Name: "zulu", WorkerID: workerB},
		{Name: "bravo", WorkerID: workerA},
		{Name: "alpha", WorkerID: workerA},
	}

	got := ToRSSRuleListResponse(rules)
	if len(got) != 3 {
		t.Fatalf("expected 3 rules, got %d", len(got))
	}

	wantOrder := []string{"alpha", "bravo", "zulu"}
	for i, name := range wantOrder {
		if got[i].Name != name {
			t.Fatalf("position %d: got name %q, want %q", i, got[i].Name, name)
		}
	}
}
