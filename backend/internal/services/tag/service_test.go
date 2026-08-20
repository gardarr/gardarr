package tag

import (
	"context"
	"testing"

	"github.com/jfxdev/gardarr/internal/entities"
	"github.com/jfxdev/gardarr/internal/infra/database"
	"github.com/jfxdev/gardarr/internal/models"
)

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
