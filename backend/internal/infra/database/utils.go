package database

import (
	"net/url"
	"testing"

	"github.com/jfxdev/gardarr/internal/constants"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// SetupTestDB creates an in-memory SQLite database for testing
// It accepts a variadic list of models to run AutoMigrate on
func SetupTestDB(t *testing.T, models ...interface{}) *Database {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to create test database: %v", err)
	}

	// Run migrations on all provided models
	if len(models) > 0 {
		if err := db.AutoMigrate(models...); err != nil {
			t.Fatalf("Failed to migrate test database: %v", err)
		}
	}

	return &Database{DB: db, driver: constants.DatabaseDriverSQLite}
}

func SetupTestDBWithCache(t *testing.T, models ...interface{}) *Database {
	dsn := "file:" + url.PathEscape(t.Name()) + "?mode=memory&cache=shared"
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to create test database: %v", err)
	}

	if err := db.AutoMigrate(models...); err != nil {
		t.Fatalf("Failed to migrate test database: %v", err)
	}

	return &Database{DB: db}
}
