package tag

import (
	"context"
	"reflect"
	"testing"

	"github.com/google/uuid"
	"github.com/jfxdev/gardarr/internal/entities"
	"github.com/jfxdev/gardarr/internal/infra/database"
	"github.com/jfxdev/gardarr/internal/models"
	"github.com/jfxdev/gardarr/internal/tagrules"
)

func TestDedupeNonEmpty(t *testing.T) {
	got := dedupeNonEmpty([]string{" a ", "b", "a", "", "  ", "c"})
	want := []string{"a", "b", "c"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %v want %v", got, want)
	}
}

func TestDetectTagConflicts(t *testing.T) {
	workerID := uuid.New()

	t.Run("no tasks", func(t *testing.T) {
		report := detectTagConflicts(nil)
		if len(report.ScopeConflicts) != 0 {
			t.Errorf("expected no scope conflicts, got %v", report.ScopeConflicts)
		}
		if len(report.GroupedTags) != 0 {
			t.Errorf("expected no grouped tags, got %v", report.GroupedTags)
		}
	})

	t.Run("single value per scope is not a conflict", func(t *testing.T) {
		tasks := []*entities.Task{
			{WorkerID: workerID, Hash: "h1", Name: "Movie", Tags: []string{"quality::4k", "movies"}},
		}
		report := detectTagConflicts(tasks)
		if len(report.ScopeConflicts) != 0 {
			t.Errorf("expected no scope conflicts, got %v", report.ScopeConflicts)
		}
	})

	t.Run("two values for the same scope is a conflict", func(t *testing.T) {
		tasks := []*entities.Task{
			{WorkerID: workerID, Hash: "h1", Name: "Movie", Tags: []string{"quality::4k", "quality::1080p"}},
		}
		report := detectTagConflicts(tasks)
		if len(report.ScopeConflicts) != 1 {
			t.Fatalf("expected 1 scope conflict, got %d", len(report.ScopeConflicts))
		}
		conflict := report.ScopeConflicts[0]
		if conflict.Scope != "quality" {
			t.Errorf("expected scope quality, got %s", conflict.Scope)
		}
		if conflict.WorkerID != workerID.String() {
			t.Errorf("expected worker id %s, got %s", workerID.String(), conflict.WorkerID)
		}
		if conflict.TaskHash != "h1" || conflict.TaskName != "Movie" {
			t.Errorf("unexpected task identity: %+v", conflict)
		}
		want := []string{"quality::1080p", "quality::4k"}
		if !reflect.DeepEqual(conflict.Tags, want) {
			t.Errorf("expected sorted tags %v, got %v", want, conflict.Tags)
		}
	})

	t.Run("different scopes on the same task don't conflict with each other", func(t *testing.T) {
		tasks := []*entities.Task{
			{WorkerID: workerID, Hash: "h1", Name: "Movie", Tags: []string{"quality::4k", "genre::action"}},
		}
		report := detectTagConflicts(tasks)
		if len(report.ScopeConflicts) != 0 {
			t.Errorf("expected no scope conflicts, got %v", report.ScopeConflicts)
		}
	})

	t.Run("conflicts across multiple tasks are all reported, sorted by task then scope", func(t *testing.T) {
		tasks := []*entities.Task{
			{WorkerID: workerID, Hash: "h2", Name: "Zeta", Tags: []string{"quality::4k", "quality::1080p"}},
			{WorkerID: workerID, Hash: "h1", Name: "Alpha", Tags: []string{"genre::action", "genre::comedy"}},
		}
		report := detectTagConflicts(tasks)
		if len(report.ScopeConflicts) != 2 {
			t.Fatalf("expected 2 scope conflicts, got %d", len(report.ScopeConflicts))
		}
		if report.ScopeConflicts[0].TaskName != "Alpha" || report.ScopeConflicts[1].TaskName != "Zeta" {
			t.Errorf("expected conflicts sorted by task name, got %+v", report.ScopeConflicts)
		}
	})

	t.Run("grouped (single colon) tags are collected, deduped and sorted", func(t *testing.T) {
		tasks := []*entities.Task{
			{WorkerID: workerID, Hash: "h1", Name: "A", Tags: []string{"S01:E02", "movies"}},
			{WorkerID: workerID, Hash: "h2", Name: "B", Tags: []string{"S01:E02", "genre:action"}},
		}
		report := detectTagConflicts(tasks)
		want := []string{"S01:E02", "genre:action"}
		if len(report.GroupedTags) != len(want) {
			t.Fatalf("expected %d grouped tags, got %v", len(want), report.GroupedTags)
		}
		for _, tag := range want {
			found := false
			for _, got := range report.GroupedTags {
				if got == tag {
					found = true
					break
				}
			}
			if !found {
				t.Errorf("expected grouped tags to include %q, got %v", tag, report.GroupedTags)
			}
		}
	})

	t.Run("scoped and plain tags are not reported as grouped", func(t *testing.T) {
		tasks := []*entities.Task{
			{WorkerID: workerID, Hash: "h1", Name: "A", Tags: []string{"quality::4k", "movies"}},
		}
		report := detectTagConflicts(tasks)
		if len(report.GroupedTags) != 0 {
			t.Errorf("expected no grouped tags, got %v", report.GroupedTags)
		}
	})
}

// newTestService builds a Service with a nil workermanager.Service, matching
// how ListTags/CreateTag are written to tolerate no worker access (see
// collectUsage and CreateTag's nil check): usage stays empty and worker
// pushes are skipped, so the local persistence path can be tested in
// isolation.
func newTestService(t *testing.T) *Service {
	t.Helper()
	db := database.SetupTestDB(t, &models.Tag{})
	return NewService(db, nil)
}

func TestServiceCreateTag(t *testing.T) {
	service := newTestService(t)
	ctx := context.Background()

	created, err := service.CreateTag(ctx, entities.Tag{
		Name:  "movies",
		Color: "#FF5733",
		Icon:  "film-icon",
	})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if created.ID == "" {
		t.Error("expected ID to be generated")
	}
	if created.Kind != entities.TagKindTag {
		t.Errorf("expected kind to default to %s, got %s", entities.TagKindTag, created.Kind)
	}
}

func TestServiceCreateTagExplicitKind(t *testing.T) {
	service := newTestService(t)
	ctx := context.Background()

	created, err := service.CreateTag(ctx, entities.Tag{Name: "quality", Kind: entities.TagKindScope})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if created.Kind != entities.TagKindScope {
		t.Errorf("expected kind %s, got %s", entities.TagKindScope, created.Kind)
	}
}

func TestServiceListTagsWithoutWorkers(t *testing.T) {
	service := newTestService(t)
	ctx := context.Background()

	if _, err := service.CreateTag(ctx, entities.Tag{Name: "movies"}); err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if _, err := service.CreateTag(ctx, entities.Tag{Name: "quality", Kind: entities.TagKindScope}); err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	list, err := service.ListTags(ctx)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(list) != 2 {
		t.Fatalf("expected 2 tags, got %d", len(list))
	}

	for _, item := range list {
		if item.Kind == entities.TagKindTag && item.UsageCount != 0 {
			t.Errorf("expected zero usage without a workermanager, got %d for %s", item.UsageCount, item.Name)
		}
	}
}

func TestServiceUpdateTag(t *testing.T) {
	service := newTestService(t)
	ctx := context.Background()

	created, err := service.CreateTag(ctx, entities.Tag{Name: "movies", Color: "#FF5733"})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	updated, err := service.UpdateTag(ctx, entities.Tag{ID: created.ID, Color: "#000000", Icon: "new-icon"})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if updated.Color != "#000000" {
		t.Errorf("expected color #000000, got %s", updated.Color)
	}
	if updated.Name != "movies" {
		t.Errorf("expected name to stay movies, got %s", updated.Name)
	}
}

func TestServiceGetTagByIDNotFound(t *testing.T) {
	service := newTestService(t)
	ctx := context.Background()

	if _, err := service.GetTagByID(ctx, "nonexistent"); err == nil {
		t.Error("expected error for nonexistent tag, got nil")
	}
}

func TestServiceDeleteTagRequiresName(t *testing.T) {
	service := newTestService(t)
	ctx := context.Background()

	if _, err := service.DeleteTag(ctx, entities.TagKindTag, "  "); err == nil {
		t.Error("expected error for empty name, got nil")
	}
}

func TestServiceDeleteTagScopeIsLocalOnly(t *testing.T) {
	// A scope row has no counterpart on qBittorrent, so deleting it must
	// never attempt a worker call - this test uses a nil workermanager, so
	// touching one would panic.
	service := newTestService(t)
	ctx := context.Background()

	if _, err := service.CreateTag(ctx, entities.Tag{Name: "quality", Kind: entities.TagKindScope}); err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	failed, err := service.DeleteTag(ctx, entities.TagKindScope, "quality")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if failed != nil {
		t.Errorf("expected no worker failures, got %v", failed)
	}

	list, err := service.ListTags(ctx)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(list) != 0 {
		t.Errorf("expected tag to be deleted, got %d remaining", len(list))
	}
}

func TestServiceDeleteTagTagKindWithoutWorkersStillDeletesLocally(t *testing.T) {
	// With a nil workermanager the worker fan-out is skipped entirely (see
	// CreateTag's own nil check), so nothing is ever "all failed" - the
	// local row must still be removed.
	service := newTestService(t)
	ctx := context.Background()

	if _, err := service.CreateTag(ctx, entities.Tag{Name: "movies"}); err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if _, err := service.DeleteTag(ctx, entities.TagKindTag, "movies"); err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	list, err := service.ListTags(ctx)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(list) != 0 {
		t.Errorf("expected tag to be deleted, got %d remaining", len(list))
	}
}

func TestServiceDeleteTagWithNoLocalRowIsNotAnError(t *testing.T) {
	service := newTestService(t)
	ctx := context.Background()

	if _, err := service.DeleteTag(ctx, entities.TagKindTag, "never-existed"); err != nil {
		t.Errorf("expected no error, got %v", err)
	}
}

func TestServiceRenameTagRejectsSameName(t *testing.T) {
	service := newTestService(t)
	ctx := context.Background()

	if _, err := service.RenameTag(ctx, "movies", "movies"); err == nil {
		t.Error("expected error for renaming a tag to itself, got nil")
	}
}

func TestServiceRenameTagDropsSourceLocalRow(t *testing.T) {
	service := newTestService(t)
	ctx := context.Background()

	if _, err := service.CreateTag(ctx, entities.Tag{Name: "movies", Color: "#FF5733"}); err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if _, err := service.RenameTag(ctx, "movies", "films"); err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	list, err := service.ListTags(ctx)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(list) != 0 {
		t.Errorf("expected source row to be dropped and no row created for target, got %d", len(list))
	}
}

func TestServiceMergeTagsRequiresSourcesAndTarget(t *testing.T) {
	service := newTestService(t)
	ctx := context.Background()

	if _, err := service.MergeTags(ctx, nil, "movies"); err == nil {
		t.Error("expected error for empty sources, got nil")
	}
	if _, err := service.MergeTags(ctx, []string{"movies"}, "  "); err == nil {
		t.Error("expected error for empty target, got nil")
	}
}

func TestServiceMergeTagsRejectsTargetInSources(t *testing.T) {
	service := newTestService(t)
	ctx := context.Background()

	_, err := service.MergeTags(ctx, []string{"movies", "films"}, "movies")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if err != ErrMergeTargetInSources {
		t.Errorf("expected ErrMergeTargetInSources, got %v", err)
	}
}

func TestServiceDeriveTagsScopedReusesSeparator(t *testing.T) {
	service := newTestService(t)
	ctx := context.Background()

	created, failed, err := service.DeriveTags(ctx, "quality::4k", "", []string{"resolution", "codec"}, "", "", "", "")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(failed) != 0 {
		t.Errorf("expected no failures, got %v", failed)
	}
	if len(created) != 2 {
		t.Fatalf("expected 2 created tags, got %d", len(created))
	}

	names := map[string]bool{}
	for _, tag := range created {
		names[tag.Name] = true
		if tag.Kind != entities.TagKindTag {
			t.Errorf("expected kind to default to %s, got %s", entities.TagKindTag, tag.Kind)
		}
	}
	if !names["resolution::4k"] || !names["codec::4k"] {
		t.Errorf("expected resolution::4k and codec::4k, got %v", names)
	}
}

func TestServiceDeriveTagsPlainRequiresDelimiter(t *testing.T) {
	service := newTestService(t)
	ctx := context.Background()

	if _, _, err := service.DeriveTags(ctx, "movies-1080p", "", []string{"quality"}, "", "", "", ""); err == nil {
		t.Error("expected error for plain source without a delimiter, got nil")
	}
}

func TestServiceDeriveTagsPlainWithDelimiter(t *testing.T) {
	service := newTestService(t)
	ctx := context.Background()

	created, failed, err := service.DeriveTags(ctx, "movies-1080p", "-", []string{"quality"}, "", "", "", "")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(failed) != 0 {
		t.Errorf("expected no failures, got %v", failed)
	}
	if len(created) != 1 || created[0].Name != "quality-1080p" {
		t.Fatalf("expected [quality-1080p], got %v", created)
	}
}

func TestServiceDeriveTagsReportsPerNameFailureWithoutAbortingBatch(t *testing.T) {
	service := newTestService(t)
	ctx := context.Background()

	if _, err := service.CreateTag(ctx, entities.Tag{Name: "codec::4k"}); err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	created, failed, err := service.DeriveTags(ctx, "quality::4k", "", []string{"codec", "resolution"}, "", "", "", "")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(created) != 1 || created[0].Name != "resolution::4k" {
		t.Fatalf("expected only resolution::4k to be created, got %v", created)
	}
	if _, ok := failed["codec::4k"]; !ok {
		t.Errorf("expected codec::4k to be reported as failed, got %v", failed)
	}
}

func TestServiceDeriveTagsModeSuffixKeepsPrefix(t *testing.T) {
	service := newTestService(t)
	ctx := context.Background()

	created, failed, err := service.DeriveTags(ctx, "quality::4k", "", []string{"1080p", "720p"}, tagrules.ModeSuffix, "", "", "")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(failed) != 0 {
		t.Errorf("expected no failures, got %v", failed)
	}

	names := map[string]bool{}
	for _, tag := range created {
		names[tag.Name] = true
	}
	if !names["quality::1080p"] || !names["quality::720p"] {
		t.Errorf("expected quality::1080p and quality::720p, got %v", names)
	}
}

func TestServiceDetectConflictsWithoutWorkers(t *testing.T) {
	// With a nil workermanager, DetectConflicts skips the worker fan-out
	// entirely and returns an empty report built from detectTagConflicts(nil)
	// - the same pure core exercised directly in TestDetectTagConflicts.
	service := newTestService(t)
	ctx := context.Background()

	report, err := service.DetectConflicts(ctx)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(report.ScopeConflicts) != 0 {
		t.Errorf("expected no scope conflicts, got %v", report.ScopeConflicts)
	}
	if len(report.GroupedTags) != 0 {
		t.Errorf("expected no grouped tags, got %v", report.GroupedTags)
	}
}

func TestServiceMergeTagsDropsAllSourceLocalRows(t *testing.T) {
	service := newTestService(t)
	ctx := context.Background()

	if _, err := service.CreateTag(ctx, entities.Tag{Name: "movies", Color: "#111111"}); err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if _, err := service.CreateTag(ctx, entities.Tag{Name: "films", Color: "#222222"}); err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	target, err := service.CreateTag(ctx, entities.Tag{Name: "cinema", Color: "#333333"})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if _, err := service.MergeTags(ctx, []string{"movies", "films"}, "cinema"); err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	list, err := service.ListTags(ctx)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("expected only the target row to survive, got %d", len(list))
	}
	if list[0].ID != target.ID {
		t.Errorf("expected surviving row to be target %s, got %s", target.ID, list[0].Name)
	}
	if list[0].Color != "#333333" {
		t.Errorf("expected target's own color to be untouched, got %s", list[0].Color)
	}
}
