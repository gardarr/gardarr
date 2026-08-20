package tag

import (
	"context"
	"testing"

	"github.com/jfxdev/gardarr/internal/entities"
	"github.com/jfxdev/gardarr/internal/infra/database"
	"github.com/jfxdev/gardarr/internal/models"
)

func TestRepositoryCreateTag(t *testing.T) {
	db := database.SetupTestDB(t, &models.Tag{})
	repo := NewRepository(db)
	ctx := context.Background()

	tag := entities.Tag{
		Name:  "movies",
		Kind:  entities.TagKindTag,
		Color: "#FF5733",
		Icon:  "film-icon",
	}

	created, err := repo.CreateTag(ctx, tag)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if created.ID == "" {
		t.Error("expected ID to be generated")
	}
	if created.Name != tag.Name {
		t.Errorf("expected name %s, got %s", tag.Name, created.Name)
	}
	if created.Kind != entities.TagKindTag {
		t.Errorf("expected kind %s, got %s", entities.TagKindTag, created.Kind)
	}
	if created.Color != tag.Color {
		t.Errorf("expected color %s, got %s", tag.Color, created.Color)
	}
	if created.Icon != tag.Icon {
		t.Errorf("expected icon %s, got %s", tag.Icon, created.Icon)
	}
}

func TestRepositoryCreateTagDuplicate(t *testing.T) {
	db := database.SetupTestDB(t, &models.Tag{})
	repo := NewRepository(db)
	ctx := context.Background()

	tag := entities.Tag{Name: "movies", Kind: entities.TagKindTag}

	if _, err := repo.CreateTag(ctx, tag); err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if _, err := repo.CreateTag(ctx, tag); err == nil {
		t.Error("expected error for duplicate tag, got nil")
	}
}

func TestRepositoryCreateTagSameNameDifferentKindIsAllowed(t *testing.T) {
	// "quality" as a plain tag and "quality" as the scope key of
	// "quality::*" tags are different rows (kind, name) - they refer to
	// unrelated things that happen to share a string.
	db := database.SetupTestDB(t, &models.Tag{})
	repo := NewRepository(db)
	ctx := context.Background()

	if _, err := repo.CreateTag(ctx, entities.Tag{Name: "quality", Kind: entities.TagKindTag}); err != nil {
		t.Fatalf("expected no error creating tag row, got %v", err)
	}
	if _, err := repo.CreateTag(ctx, entities.Tag{Name: "quality", Kind: entities.TagKindScope}); err != nil {
		t.Fatalf("expected no error creating scope row with the same name, got %v", err)
	}
}

func TestRepositoryListTags(t *testing.T) {
	db := database.SetupTestDB(t, &models.Tag{})
	repo := NewRepository(db)
	ctx := context.Background()

	list, err := repo.ListTags(ctx)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(list) != 0 {
		t.Errorf("expected empty list, got %d", len(list))
	}

	if _, err := repo.CreateTag(ctx, entities.Tag{Name: "movies", Kind: entities.TagKindTag}); err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if _, err := repo.CreateTag(ctx, entities.Tag{Name: "music", Kind: entities.TagKindTag}); err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	list, err = repo.ListTags(ctx)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(list) != 2 {
		t.Errorf("expected 2 tags, got %d", len(list))
	}
}

func TestRepositoryGetTagByID(t *testing.T) {
	db := database.SetupTestDB(t, &models.Tag{})
	repo := NewRepository(db)
	ctx := context.Background()

	created, err := repo.CreateTag(ctx, entities.Tag{Name: "movies", Kind: entities.TagKindTag})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	found, err := repo.GetTagByID(ctx, created.ID)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if found.Name != created.Name {
		t.Errorf("expected name %s, got %s", created.Name, found.Name)
	}
}

func TestRepositoryGetTagByIDNotFound(t *testing.T) {
	db := database.SetupTestDB(t, &models.Tag{})
	repo := NewRepository(db)
	ctx := context.Background()

	if _, err := repo.GetTagByID(ctx, "nonexistent"); err == nil {
		t.Error("expected error for nonexistent tag, got nil")
	}
}

func TestRepositoryGetTagByName(t *testing.T) {
	db := database.SetupTestDB(t, &models.Tag{})
	repo := NewRepository(db)
	ctx := context.Background()

	if _, err := repo.CreateTag(ctx, entities.Tag{Name: "quality", Kind: entities.TagKindScope, Color: "#123456"}); err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	found, err := repo.GetTagByName(ctx, entities.TagKindScope, "quality")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if found.Color != "#123456" {
		t.Errorf("expected color #123456, got %s", found.Color)
	}

	if _, err := repo.GetTagByName(ctx, entities.TagKindTag, "quality"); err == nil {
		t.Error("expected error looking up a different kind with the same name, got nil")
	}
}

func TestRepositoryUpdateTag(t *testing.T) {
	db := database.SetupTestDB(t, &models.Tag{})
	repo := NewRepository(db)
	ctx := context.Background()

	created, err := repo.CreateTag(ctx, entities.Tag{Name: "movies", Kind: entities.TagKindTag, Color: "#FF5733"})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	updated, err := repo.UpdateTag(ctx, entities.Tag{ID: created.ID, Color: "#000000", Icon: "new-icon"})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if updated.Color != "#000000" {
		t.Errorf("expected color #000000, got %s", updated.Color)
	}
	if updated.Icon != "new-icon" {
		t.Errorf("expected icon new-icon, got %s", updated.Icon)
	}
	if updated.Name != "movies" {
		t.Errorf("expected name to stay movies, got %s", updated.Name)
	}
}

func TestRepositoryUpdateTagNotFound(t *testing.T) {
	db := database.SetupTestDB(t, &models.Tag{})
	repo := NewRepository(db)
	ctx := context.Background()

	if _, err := repo.UpdateTag(ctx, entities.Tag{ID: "nonexistent", Color: "#000000"}); err == nil {
		t.Error("expected error for nonexistent tag, got nil")
	}
}

func TestRepositoryDeleteTag(t *testing.T) {
	db := database.SetupTestDB(t, &models.Tag{})
	repo := NewRepository(db)
	ctx := context.Background()

	created, err := repo.CreateTag(ctx, entities.Tag{Name: "movies", Kind: entities.TagKindTag})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if err := repo.DeleteTag(ctx, created.ID); err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if _, err := repo.GetTagByID(ctx, created.ID); err == nil {
		t.Error("expected tag to be deleted, got nil error on lookup")
	}
}

func TestRepositoryDeleteTagNotFound(t *testing.T) {
	db := database.SetupTestDB(t, &models.Tag{})
	repo := NewRepository(db)
	ctx := context.Background()

	if err := repo.DeleteTag(ctx, "nonexistent"); err == nil {
		t.Error("expected error for nonexistent tag, got nil")
	}
}

func TestRepositoryDeleteTagByName(t *testing.T) {
	db := database.SetupTestDB(t, &models.Tag{})
	repo := NewRepository(db)
	ctx := context.Background()

	if _, err := repo.CreateTag(ctx, entities.Tag{Name: "movies", Kind: entities.TagKindTag}); err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if err := repo.DeleteTagByName(ctx, entities.TagKindTag, "movies"); err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if _, err := repo.GetTagByName(ctx, entities.TagKindTag, "movies"); err == nil {
		t.Error("expected tag to be deleted, got nil error on lookup")
	}
}

func TestRepositoryDeleteTagByNameNoLocalRowIsNotAnError(t *testing.T) {
	// A tag only ever observed live on a worker has no local row - deleting
	// it by name must not error, since the row's absence is already the
	// correct managed state.
	db := database.SetupTestDB(t, &models.Tag{})
	repo := NewRepository(db)
	ctx := context.Background()

	if err := repo.DeleteTagByName(ctx, entities.TagKindTag, "nonexistent"); err != nil {
		t.Errorf("expected no error, got %v", err)
	}
}

func TestRepositoryDeleteTagByNameOnlyMatchesItsOwnKind(t *testing.T) {
	db := database.SetupTestDB(t, &models.Tag{})
	repo := NewRepository(db)
	ctx := context.Background()

	if _, err := repo.CreateTag(ctx, entities.Tag{Name: "quality", Kind: entities.TagKindScope}); err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if err := repo.DeleteTagByName(ctx, entities.TagKindTag, "quality"); err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if _, err := repo.GetTagByName(ctx, entities.TagKindScope, "quality"); err != nil {
		t.Errorf("expected scope row to survive deleting a different kind, got %v", err)
	}
}

func TestRepositoryReconcileMergedTags(t *testing.T) {
	db := database.SetupTestDB(t, &models.Tag{})
	repo := NewRepository(db)
	ctx := context.Background()

	if _, err := repo.CreateTag(ctx, entities.Tag{Name: "movies", Kind: entities.TagKindTag, Color: "#111111"}); err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if _, err := repo.CreateTag(ctx, entities.Tag{Name: "films", Kind: entities.TagKindTag, Color: "#222222"}); err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	target, err := repo.CreateTag(ctx, entities.Tag{Name: "cinema", Kind: entities.TagKindTag, Color: "#333333"})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if err := repo.ReconcileMergedTags(ctx, []string{"movies", "films"}); err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if _, err := repo.GetTagByName(ctx, entities.TagKindTag, "movies"); err == nil {
		t.Error("expected source 'movies' row to be deleted")
	}
	if _, err := repo.GetTagByName(ctx, entities.TagKindTag, "films"); err == nil {
		t.Error("expected source 'films' row to be deleted")
	}

	survivingTarget, err := repo.GetTagByID(ctx, target.ID)
	if err != nil {
		t.Fatalf("expected target row to survive, got error: %v", err)
	}
	if survivingTarget.Color != "#333333" {
		t.Errorf("expected target's own color to be untouched, got %s", survivingTarget.Color)
	}
}

func TestRepositoryReconcileMergedTagsEmptySourcesIsNoop(t *testing.T) {
	db := database.SetupTestDB(t, &models.Tag{})
	repo := NewRepository(db)
	ctx := context.Background()

	if err := repo.ReconcileMergedTags(ctx, nil); err != nil {
		t.Errorf("expected no error, got %v", err)
	}
}
