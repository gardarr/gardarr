package tag

import (
	"context"
	"reflect"
	"testing"

	"github.com/jfxdev/gardarr/internal/entities"
	"github.com/jfxdev/gardarr/internal/infra/database"
	"github.com/jfxdev/gardarr/internal/models"
)

func TestDedupeNonEmpty(t *testing.T) {
	got := dedupeNonEmpty([]string{" a ", "b", "a", "", "  ", "c"})
	want := []string{"a", "b", "c"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %v want %v", got, want)
	}
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
