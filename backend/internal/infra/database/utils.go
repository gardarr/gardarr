package database

import (
	"net/url"
	"testing"

	"github.com/jfxdev/gardarr/internal/constants"
	"github.com/jfxdev/gardarr/internal/infra/database/migrations"
	"github.com/jfxdev/gardarr/internal/infra/migration"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

const (
	failedToCreateTestDatabase  = "Failed to create test database: %v"
	failedToMigrateTestDatabase = "Failed to migrate test database: %v"
)

// SetupTestDB creates an in-memory SQLite database for testing
// It accepts a variadic list of models to run AutoMigrate on
func SetupTestDB(t *testing.T, models ...interface{}) *Database {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf(failedToCreateTestDatabase, err)
	}

	// Run migrations on all provided models
	if len(models) > 0 {
		if err := db.AutoMigrate(models...); err != nil {
			t.Fatalf(failedToMigrateTestDatabase, err)
		}
	}

	return &Database{DB: db, driver: constants.DatabaseDriverSQLite}
}

func SetupTestDBWithCache(t *testing.T, models ...interface{}) *Database {
	dsn := "file:" + url.PathEscape(t.Name()) + "?mode=memory&cache=shared"
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf(failedToCreateTestDatabase, err)
	}

	if err := db.AutoMigrate(models...); err != nil {
		t.Fatalf(failedToMigrateTestDatabase, err)
	}

	return &Database{DB: db}
}

// SetupTestDBWithMigrations creates an in-memory SQLite database for testing
// and runs all registered migrations (matching production behavior exactly)
func SetupTestDBWithMigrations(t *testing.T) *Database {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf(failedToCreateTestDatabase, err)
	}

	database := &Database{DB: db, driver: constants.DatabaseDriverSQLite}

	// Run all migrations as they would run in production
	m := migration.NewMigrator(db)
	migrations.Register(m)
	if err := m.Up(); err != nil {
		t.Fatalf(failedToMigrateTestDatabase, err)
	}

	return database
}
