package migrations

import (
	"slices"
	"testing"

	"github.com/jfxdev/gardarr/internal/infra/migration"
	"github.com/jfxdev/gardarr/internal/models"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var expectedSeededCategories = map[string]struct {
	Icon  string
	Color string
}{
	"Movies": {Icon: "Film", Color: "#ef4444"},
	"Shows":  {Icon: "Tv", Color: "#3b82f6"},
	"Games":  {Icon: "Gamepad2", Color: "#10b981"},
	"Other":  {Icon: "Folder", Color: "#6b7280"},
	"Books":  {Icon: "BookOpen", Color: "#f59e0b"},
	"Anime":  {Icon: "Star", Color: "#ec4899"},
	"Music":  {Icon: "Music", Color: "#14b8a6"},
}

func TestMigration007AddColorIconToCategories(t *testing.T) {
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
		ID:               "test-category-id",
		Name:             "Test Category",
		Color:            "#FF5733",
		Icon:             "Folder",
		DefaultTags:      models.StringArray{"tag1", "tag2"},
		DefaultDirectory: "/path1",
		MetadataSource:   "none",
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

func TestMigration026SeedsDefaultCategories(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to create test database: %v", err)
	}

	m := migration.NewMigrator(db)
	Register(m)

	if err := m.Up(); err != nil {
		t.Fatalf("Failed to run migrations: %v", err)
	}

	assertSeededCategories(t, db)
}

func TestMigrationAllMigrationsCanRunTwice(t *testing.T) {
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

	assertSeededCategories(t, db)
}

func TestMigration026SeedsOnlyMissingCategories(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to create test database: %v", err)
	}

	m := migration.NewMigrator(db)
	Register(m)

	if err := m.Up(); err != nil {
		t.Fatalf("Failed to run migrations: %v", err)
	}

	existingMovies := models.Category{
		ID:               "custom-movies-id",
		Name:             "Movies",
		Color:            "#000000",
		Icon:             "Archive",
		DefaultDirectory: "/custom/movies",
		MetadataSource:   "none",
		DefaultTags:      models.StringArray{"existing"},
	}

	if err := db.Where("name = ?", "Movies").Delete(&models.Category{}).Error; err != nil {
		t.Fatalf("Failed to remove seeded Movies category: %v", err)
	}

	if err := db.Create(&existingMovies).Error; err != nil {
		t.Fatalf("Failed to create existing Movies category: %v", err)
	}

	if err := db.Table("migrations").Where("version = ?", "026_seed_default_categories").Delete(&migration.Migration{}).Error; err != nil {
		t.Fatalf("Failed to reset migration record: %v", err)
	}

	if err := m.Up(); err != nil {
		t.Fatalf("Failed to rerun migrations after seeding existing category: %v", err)
	}

	var movies []models.Category
	if err := db.Where("name = ?", "Movies").Find(&movies).Error; err != nil {
		t.Fatalf("Failed to load Movies categories: %v", err)
	}

	if len(movies) != 1 {
		t.Fatalf("Expected exactly 1 Movies category, got %d", len(movies))
	}

	if movies[0].ID != existingMovies.ID {
		t.Errorf("Expected existing Movies category to be preserved, got ID %s", movies[0].ID)
	}

	if movies[0].Color != existingMovies.Color {
		t.Errorf("Expected existing Movies color %s to be preserved, got %s", existingMovies.Color, movies[0].Color)
	}

	if movies[0].Icon != existingMovies.Icon {
		t.Errorf("Expected existing Movies icon %s to be preserved, got %s", existingMovies.Icon, movies[0].Icon)
	}

	var categories []models.Category
	if err := db.Find(&categories).Error; err != nil {
		t.Fatalf("Failed to list categories: %v", err)
	}

	if len(categories) != len(expectedSeededCategories) {
		t.Fatalf("Expected %d total categories after reseed, got %d", len(expectedSeededCategories), len(categories))
	}

	for _, category := range categories {
		if category.Name == "Movies" {
			continue
		}

		expected, ok := expectedSeededCategories[category.Name]
		if !ok {
			t.Fatalf("Unexpected category found: %s", category.Name)
		}

		if category.Icon != expected.Icon {
			t.Errorf("Expected icon %s for %s, got %s", expected.Icon, category.Name, category.Icon)
		}

		if category.Color != expected.Color {
			t.Errorf("Expected color %s for %s, got %s", expected.Color, category.Name, category.Color)
		}
	}
}

func assertSeededCategories(t *testing.T, db *gorm.DB) {
	t.Helper()

	var categories []models.Category
	if err := db.Find(&categories).Error; err != nil {
		t.Fatalf("Failed to list categories: %v", err)
	}

	if len(categories) != len(expectedSeededCategories) {
		t.Fatalf("Expected %d seeded categories, got %d", len(expectedSeededCategories), len(categories))
	}

	seenNames := make([]string, 0, len(categories))
	for _, category := range categories {
		expected, ok := expectedSeededCategories[category.Name]
		if !ok {
			t.Fatalf("Unexpected category found: %s", category.Name)
		}

		seenNames = append(seenNames, category.Name)

		if category.Icon != expected.Icon {
			t.Errorf("Expected icon %s for %s, got %s", expected.Icon, category.Name, category.Icon)
		}

		if category.Color != expected.Color {
			t.Errorf("Expected color %s for %s, got %s", expected.Color, category.Name, category.Color)
		}

		if category.DefaultDirectory != "" {
			t.Errorf("Expected empty default directory for %s, got %s", category.Name, category.DefaultDirectory)
		}

		if len(category.DefaultTags) != 0 {
			t.Errorf("Expected no default tags for %s, got %v", category.Name, []string(category.DefaultTags))
		}

		if category.MetadataSource != "none" {
			t.Errorf("Expected metadata source 'none' for %s, got %s", category.Name, category.MetadataSource)
		}
	}

	for name := range expectedSeededCategories {
		if !slices.Contains(seenNames, name) {
			t.Errorf("Expected category %s to be seeded", name)
		}
	}
}

func TestMigration027RenamesCategoryDirectoryAndAddsMetadataSource(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to create test database: %v", err)
	}

	m := migration.NewMigrator(db)
	Register(m)

	if err := m.Up(); err != nil {
		t.Fatalf("Failed to run migrations: %v", err)
	}

	if !db.Migrator().HasColumn(&models.Category{}, "default_directory") {
		t.Error("Expected default_directory column to exist in categories table")
	}

	if !db.Migrator().HasColumn(&models.Category{}, "metadata_source") {
		t.Error("Expected metadata_source column to exist in categories table")
	}
}

func TestMigration028CreatesIntegrationProviderConfigsTable(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to create test database: %v", err)
	}

	m := migration.NewMigrator(db)
	Register(m)

	if err := m.Up(); err != nil {
		t.Fatalf("Failed to run migrations: %v", err)
	}

	if !db.Migrator().HasTable(&models.IntegrationProviderConfig{}) {
		t.Error("Expected integration provider configs table to exist")
	}
}
