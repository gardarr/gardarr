package migrations

import (
	"testing"

	"github.com/gardarr/gardarr/internal/infra/migration"
	"github.com/gardarr/gardarr/internal/models"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestMigration_007_AddColorIconToCategories(t *testing.T) {
	// Create in-memory SQLite database
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to create test database: %v", err)
	}

	// Create migrator and register migrations
	m := migration.NewMigrator(db)
	Register(m)

	// Run all migrations
	if err := m.Up(); err != nil {
		t.Fatalf("Failed to run migrations: %v", err)
	}

	// Verify that the categories table exists
	if !db.Migrator().HasTable(&models.Category{}) {
		t.Error("Expected categories table to exist")
	}

	// Verify that color column exists
	if !db.Migrator().HasColumn(&models.Category{}, "color") {
		t.Error("Expected color column to exist in categories table")
	}

	// Verify that icon column exists
	if !db.Migrator().HasColumn(&models.Category{}, "icon") {
		t.Error("Expected icon column to exist in categories table")
	}

	// Test creating a category with color and icon
	category := models.Category{
		ID:          "test-category-id",
		Name:        "Test Category",
		Color:       "#FF5733",
		Icon:        "Folder",
		DefaultTags: models.StringArray{"tag1", "tag2"},
		Directories: models.StringArray{"/path1"},
	}

	if err := db.Create(&category).Error; err != nil {
		t.Errorf("Failed to create category with color and icon: %v", err)
	}

	// Retrieve and verify
	var retrieved models.Category
	if err := db.Where("id = ?", "test-category-id").First(&retrieved).Error; err != nil {
		t.Errorf("Failed to retrieve category: %v", err)
	}

	if retrieved.Color != "#FF5733" {
		t.Errorf("Expected color #FF5733, got %s", retrieved.Color)
	}

	if retrieved.Icon != "Folder" {
		t.Errorf("Expected icon 'Folder', got %s", retrieved.Icon)
	}
}

func TestMigration_AllMigrationsCanRunTwice(t *testing.T) {
	// Create in-memory SQLite database
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to create test database: %v", err)
	}

	// Create migrator and register migrations
	m := migration.NewMigrator(db)
	Register(m)

	// Run all migrations first time
	if err := m.Up(); err != nil {
		t.Fatalf("Failed to run migrations first time: %v", err)
	}

	// Run all migrations second time (should skip already applied)
	if err := m.Up(); err != nil {
		t.Fatalf("Failed to run migrations second time: %v", err)
	}
}
