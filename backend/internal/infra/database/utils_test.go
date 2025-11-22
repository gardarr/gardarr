package database

import (
	"testing"

	"github.com/jfxdev/gardarr/internal/models"
)

func TestSetupTestDB(t *testing.T) {
	// Test with no models
	db := SetupTestDB(t)
	if db == nil {
		t.Fatal("Expected database instance, got nil")
	}
	if db.DB == nil {
		t.Fatal("Expected GORM DB instance, got nil")
	}

	// Verify database is accessible
	sqlDB, err := db.DB.DB()
	if err != nil {
		t.Fatalf("Failed to get underlying sql.DB: %v", err)
	}
	if err := sqlDB.Ping(); err != nil {
		t.Fatalf("Failed to ping database: %v", err)
	}
}

func TestSetupTestDB_WithModels(t *testing.T) {
	// Test with models
	db := SetupTestDB(t, &models.Category{})
	if db == nil {
		t.Fatal("Expected database instance, got nil")
	}

	// Verify migration was successful by checking if table exists
	if !db.DB.Migrator().HasTable(&models.Category{}) {
		t.Error("Expected Category table to exist after migration")
	}
}

func TestSetupTestDB_WithMultipleModels(t *testing.T) {
	// Test with multiple models
	db := SetupTestDB(t, &models.Category{}, &models.User{})
	if db == nil {
		t.Fatal("Expected database instance, got nil")
	}

	// Verify all tables were created
	if !db.DB.Migrator().HasTable(&models.Category{}) {
		t.Error("Expected Category table to exist after migration")
	}
	if !db.DB.Migrator().HasTable(&models.User{}) {
		t.Error("Expected User table to exist after migration")
	}
}
