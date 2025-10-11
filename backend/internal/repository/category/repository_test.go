package category

import (
	"context"
	"testing"

	"github.com/gardarr/gardarr/internal/entities"
	"github.com/gardarr/gardarr/internal/infra/database"
	"github.com/gardarr/gardarr/internal/models"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// setupTestDB creates an in-memory SQLite database for testing
func setupTestDB(t *testing.T) *database.Database {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to create test database: %v", err)
	}

	// Run migrations
	if err := db.AutoMigrate(&models.Category{}); err != nil {
		t.Fatalf("Failed to migrate test database: %v", err)
	}

	return &database.Database{DB: db}
}

func TestRepository_CreateCategory(t *testing.T) {
	db := setupTestDB(t)
	repo := NewRepository(db)
	ctx := context.Background()

	category := entities.Category{
		Name:        "Movies",
		DefaultTags: []string{"hd", "english"},
		Directories: []string{"/movies", "/cinema"},
	}

	created, err := repo.CreateCategory(ctx, category)
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	if created == nil {
		t.Error("Expected created category, got nil")
		return
	}

	if created.ID == "" {
		t.Error("Expected ID to be generated")
	}

	if created.Name != category.Name {
		t.Errorf("Expected name %s, got %s", category.Name, created.Name)
	}

	if len(created.DefaultTags) != len(category.DefaultTags) {
		t.Errorf("Expected %d tags, got %d", len(category.DefaultTags), len(created.DefaultTags))
	}

	if len(created.Directories) != len(category.Directories) {
		t.Errorf("Expected %d directories, got %d", len(category.Directories), len(created.Directories))
	}
}

func TestRepository_CreateCategory_Duplicate(t *testing.T) {
	db := setupTestDB(t)
	repo := NewRepository(db)
	ctx := context.Background()

	category := entities.Category{
		Name:        "Series",
		DefaultTags: []string{"hd"},
		Directories: []string{"/series"},
	}

	// Create first category
	_, err := repo.CreateCategory(ctx, category)
	if err != nil {
		t.Fatalf("Expected no error on first create, got %v", err)
	}

	// Attempt to create duplicate
	_, err = repo.CreateCategory(ctx, category)
	if err == nil {
		t.Error("Expected error for duplicate category, got nil")
	}
}

func TestRepository_ListCategories(t *testing.T) {
	db := setupTestDB(t)
	repo := NewRepository(db)
	ctx := context.Background()

	// Test empty list
	categories, err := repo.ListCategories(ctx)
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	if len(categories) != 0 {
		t.Errorf("Expected 0 categories, got %d", len(categories))
	}

	// Create test categories
	testCategories := []entities.Category{
		{Name: "Movies", DefaultTags: []string{"hd"}, Directories: []string{"/movies"}},
		{Name: "Series", DefaultTags: []string{"hd"}, Directories: []string{"/series"}},
		{Name: "Music", DefaultTags: []string{"flac"}, Directories: []string{"/music"}},
	}

	for _, cat := range testCategories {
		_, err := repo.CreateCategory(ctx, cat)
		if err != nil {
			t.Fatalf("Failed to create category: %v", err)
		}
	}

	// List all categories
	categories, err = repo.ListCategories(ctx)
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	if len(categories) != len(testCategories) {
		t.Errorf("Expected %d categories, got %d", len(testCategories), len(categories))
	}
}

func TestRepository_GetCategoryByID(t *testing.T) {
	db := setupTestDB(t)
	repo := NewRepository(db)
	ctx := context.Background()

	// Create a category
	category := entities.Category{
		Name:        "Books",
		DefaultTags: []string{"epub", "pdf"},
		Directories: []string{"/books"},
	}

	created, err := repo.CreateCategory(ctx, category)
	if err != nil {
		t.Fatalf("Failed to create category: %v", err)
	}

	// Get by ID
	retrieved, err := repo.GetCategoryByID(ctx, created.ID)
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	if retrieved.ID != created.ID {
		t.Errorf("Expected ID %s, got %s", created.ID, retrieved.ID)
	}

	if retrieved.Name != created.Name {
		t.Errorf("Expected name %s, got %s", created.Name, retrieved.Name)
	}

	// Test non-existent ID
	_, err = repo.GetCategoryByID(ctx, "non-existent-id")
	if err == nil {
		t.Error("Expected error for non-existent ID, got nil")
	}
}

func TestRepository_GetCategoryByName(t *testing.T) {
	db := setupTestDB(t)
	repo := NewRepository(db)
	ctx := context.Background()

	// Create a category
	category := entities.Category{
		Name:        "Games",
		DefaultTags: []string{"pc", "console"},
		Directories: []string{"/games"},
	}

	created, err := repo.CreateCategory(ctx, category)
	if err != nil {
		t.Fatalf("Failed to create category: %v", err)
	}

	// Get by name
	retrieved, err := repo.GetCategoryByName(ctx, category.Name)
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	if retrieved.ID != created.ID {
		t.Errorf("Expected ID %s, got %s", created.ID, retrieved.ID)
	}

	if retrieved.Name != created.Name {
		t.Errorf("Expected name %s, got %s", created.Name, retrieved.Name)
	}

	// Test non-existent name
	_, err = repo.GetCategoryByName(ctx, "non-existent-name")
	if err == nil {
		t.Error("Expected error for non-existent name, got nil")
	}
}

func TestRepository_UpdateCategory(t *testing.T) {
	db := setupTestDB(t)
	repo := NewRepository(db)
	ctx := context.Background()

	// Create a category
	category := entities.Category{
		Name:        "Software",
		DefaultTags: []string{"linux"},
		Directories: []string{"/software"},
	}

	created, err := repo.CreateCategory(ctx, category)
	if err != nil {
		t.Fatalf("Failed to create category: %v", err)
	}

	// Update the category
	created.Name = "Software Updated"
	created.DefaultTags = []string{"linux", "windows"}
	created.Directories = []string{"/software", "/apps"}

	updated, err := repo.UpdateCategory(ctx, *created)
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	if updated.Name != "Software Updated" {
		t.Errorf("Expected updated name, got %s", updated.Name)
	}

	if len(updated.DefaultTags) != 2 {
		t.Errorf("Expected 2 tags, got %d", len(updated.DefaultTags))
	}

	if len(updated.Directories) != 2 {
		t.Errorf("Expected 2 directories, got %d", len(updated.Directories))
	}

	// Test update non-existent category
	nonExistent := entities.Category{
		ID:   "non-existent",
		Name: "Test",
	}
	_, err = repo.UpdateCategory(ctx, nonExistent)
	if err == nil {
		t.Error("Expected error for non-existent category update, got nil")
	}
}

func TestRepository_DeleteCategory(t *testing.T) {
	db := setupTestDB(t)
	repo := NewRepository(db)
	ctx := context.Background()

	// Create a category
	category := entities.Category{
		Name:        "Documents",
		DefaultTags: []string{"pdf"},
		Directories: []string{"/docs"},
	}

	created, err := repo.CreateCategory(ctx, category)
	if err != nil {
		t.Fatalf("Failed to create category: %v", err)
	}

	// Delete the category
	err = repo.DeleteCategory(ctx, created.ID)
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	// Verify deletion
	_, err = repo.GetCategoryByID(ctx, created.ID)
	if err == nil {
		t.Error("Expected error when retrieving deleted category, got nil")
	}

	// Test delete non-existent category
	err = repo.DeleteCategory(ctx, "non-existent-id")
	if err == nil {
		t.Error("Expected error for non-existent category deletion, got nil")
	}
}

func TestRepository_ToCategoryConversion(t *testing.T) {
	model := models.Category{
		ID:          "test-id",
		Name:        "Test Category",
		DefaultTags: models.StringArray{"tag1", "tag2"},
		Directories: models.StringArray{"/path1", "/path2"},
	}

	entity := toCategory(model)

	if entity.ID != model.ID {
		t.Errorf("Expected ID %s, got %s", model.ID, entity.ID)
	}

	if entity.Name != model.Name {
		t.Errorf("Expected name %s, got %s", model.Name, entity.Name)
	}

	if len(entity.DefaultTags) != len(model.DefaultTags) {
		t.Errorf("Expected %d tags, got %d", len(model.DefaultTags), len(entity.DefaultTags))
	}

	if len(entity.Directories) != len(model.Directories) {
		t.Errorf("Expected %d directories, got %d", len(model.Directories), len(entity.Directories))
	}
}
