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

func TestService_CreateCategory(t *testing.T) {
	db := setupTestDB(t)
	service := NewService(db)
	ctx := context.Background()

	category := entities.Category{
		Name:        "Test Category",
		DefaultTags: []string{"tag1", "tag2"},
		Directories: []string{"/path1", "/path2"},
	}

	created, err := service.CreateCategory(ctx, category)
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
}

func TestService_ListCategories(t *testing.T) {
	db := setupTestDB(t)
	service := NewService(db)
	ctx := context.Background()

	// Test empty list
	categories, err := service.ListCategories(ctx)
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	if len(categories) != 0 {
		t.Errorf("Expected 0 categories, got %d", len(categories))
	}

	// Create test categories
	testCategories := []entities.Category{
		{Name: "Category 1", DefaultTags: []string{"tag1"}, Directories: []string{"/path1"}},
		{Name: "Category 2", DefaultTags: []string{"tag2"}, Directories: []string{"/path2"}},
	}

	for _, cat := range testCategories {
		_, err := service.CreateCategory(ctx, cat)
		if err != nil {
			t.Fatalf("Failed to create category: %v", err)
		}
	}

	// List all categories
	categories, err = service.ListCategories(ctx)
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	if len(categories) != len(testCategories) {
		t.Errorf("Expected %d categories, got %d", len(testCategories), len(categories))
	}
}

func TestService_GetCategoryByID(t *testing.T) {
	db := setupTestDB(t)
	service := NewService(db)
	ctx := context.Background()

	// Create a category
	category := entities.Category{
		Name:        "Test Category",
		DefaultTags: []string{"tag1"},
		Directories: []string{"/path1"},
	}

	created, err := service.CreateCategory(ctx, category)
	if err != nil {
		t.Fatalf("Failed to create category: %v", err)
	}

	// Get by ID
	retrieved, err := service.GetCategoryByID(ctx, created.ID)
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	if retrieved.ID != created.ID {
		t.Errorf("Expected ID %s, got %s", created.ID, retrieved.ID)
	}

	// Test non-existent ID
	_, err = service.GetCategoryByID(ctx, "non-existent-id")
	if err == nil {
		t.Error("Expected error for non-existent ID, got nil")
	}
}

func TestService_GetCategoryByName(t *testing.T) {
	db := setupTestDB(t)
	service := NewService(db)
	ctx := context.Background()

	// Create a category
	category := entities.Category{
		Name:        "Unique Name",
		DefaultTags: []string{"tag1"},
		Directories: []string{"/path1"},
	}

	created, err := service.CreateCategory(ctx, category)
	if err != nil {
		t.Fatalf("Failed to create category: %v", err)
	}

	// Get by name
	retrieved, err := service.GetCategoryByName(ctx, category.Name)
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	if retrieved.ID != created.ID {
		t.Errorf("Expected ID %s, got %s", created.ID, retrieved.ID)
	}

	// Test non-existent name
	_, err = service.GetCategoryByName(ctx, "non-existent-name")
	if err == nil {
		t.Error("Expected error for non-existent name, got nil")
	}
}

func TestService_UpdateCategory(t *testing.T) {
	db := setupTestDB(t)
	service := NewService(db)
	ctx := context.Background()

	// Create a category
	category := entities.Category{
		Name:        "Original Name",
		DefaultTags: []string{"tag1"},
		Directories: []string{"/path1"},
	}

	created, err := service.CreateCategory(ctx, category)
	if err != nil {
		t.Fatalf("Failed to create category: %v", err)
	}

	// Update the category
	created.Name = "Updated Name"
	created.DefaultTags = []string{"tag1", "tag2"}
	created.Directories = []string{"/path1", "/path2"}

	updated, err := service.UpdateCategory(ctx, *created)
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	if updated.Name != "Updated Name" {
		t.Errorf("Expected updated name, got %s", updated.Name)
	}

	if len(updated.DefaultTags) != 2 {
		t.Errorf("Expected 2 tags, got %d", len(updated.DefaultTags))
	}
}

func TestService_DeleteCategory(t *testing.T) {
	db := setupTestDB(t)
	service := NewService(db)
	ctx := context.Background()

	// Create a category
	category := entities.Category{
		Name:        "To Be Deleted",
		DefaultTags: []string{"tag1"},
		Directories: []string{"/path1"},
	}

	created, err := service.CreateCategory(ctx, category)
	if err != nil {
		t.Fatalf("Failed to create category: %v", err)
	}

	// Delete the category
	err = service.DeleteCategory(ctx, created.ID)
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	// Verify deletion
	_, err = service.GetCategoryByID(ctx, created.ID)
	if err == nil {
		t.Error("Expected error when retrieving deleted category, got nil")
	}
}

func TestService_Integration_FullCRUD(t *testing.T) {
	db := setupTestDB(t)
	service := NewService(db)
	ctx := context.Background()

	// Create
	category := entities.Category{
		Name:        "Integration Test",
		DefaultTags: []string{"test"},
		Directories: []string{"/test"},
	}

	created, err := service.CreateCategory(ctx, category)
	if err != nil {
		t.Fatalf("Create failed: %v", err)
	}

	// Read by ID
	retrieved, err := service.GetCategoryByID(ctx, created.ID)
	if err != nil {
		t.Fatalf("GetByID failed: %v", err)
	}

	if retrieved.Name != category.Name {
		t.Errorf("Expected name %s, got %s", category.Name, retrieved.Name)
	}

	// Read by Name
	retrievedByName, err := service.GetCategoryByName(ctx, category.Name)
	if err != nil {
		t.Fatalf("GetByName failed: %v", err)
	}

	if retrievedByName.ID != created.ID {
		t.Errorf("Expected ID %s, got %s", created.ID, retrievedByName.ID)
	}

	// Update
	created.Name = "Updated Integration Test"
	updated, err := service.UpdateCategory(ctx, *created)
	if err != nil {
		t.Fatalf("Update failed: %v", err)
	}

	if updated.Name != "Updated Integration Test" {
		t.Errorf("Expected updated name, got %s", updated.Name)
	}

	// List
	categories, err := service.ListCategories(ctx)
	if err != nil {
		t.Fatalf("List failed: %v", err)
	}

	if len(categories) != 1 {
		t.Errorf("Expected 1 category, got %d", len(categories))
	}

	// Delete
	err = service.DeleteCategory(ctx, created.ID)
	if err != nil {
		t.Fatalf("Delete failed: %v", err)
	}

	// Verify deletion
	categories, err = service.ListCategories(ctx)
	if err != nil {
		t.Fatalf("List after delete failed: %v", err)
	}

	if len(categories) != 0 {
		t.Errorf("Expected 0 categories after delete, got %d", len(categories))
	}
}
