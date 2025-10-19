package password_reset

import (
	"context"
	"testing"
	"time"

	"github.com/gardarr/gardarr/internal/infra/database"
	"github.com/gardarr/gardarr/internal/models"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupTestDB(t *testing.T) *database.Database {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to connect to test database: %v", err)
	}

	// Auto migrate models
	if err := db.AutoMigrate(&models.PasswordResetToken{}); err != nil {
		t.Fatalf("failed to migrate test database: %v", err)
	}

	return &database.Database{DB: db}
}

func TestCreateToken(t *testing.T) {
	db := setupTestDB(t)
	repo := NewRepository(db)
	ctx := context.Background()

	token := "test-token-123"
	email := "test@example.com"
	expiresAt := time.Now().Add(1 * time.Hour)

	createdToken, err := repo.CreateToken(ctx, token, email, expiresAt)
	if err != nil {
		t.Fatalf("failed to create token: %v", err)
	}

	if createdToken == nil {
		t.Fatal("expected token but got nil")
	}
	if createdToken.Token != token {
		t.Errorf("expected token '%s' but got '%s'", token, createdToken.Token)
	}
	if createdToken.Email != email {
		t.Errorf("expected email '%s' but got '%s'", email, createdToken.Email)
	}
}

func TestGetTokenByValue(t *testing.T) {
	db := setupTestDB(t)
	repo := NewRepository(db)
	ctx := context.Background()

	token := "test-token-456"
	email := "get@example.com"
	expiresAt := time.Now().Add(1 * time.Hour)

	// Create a token
	_, err := repo.CreateToken(ctx, token, email, expiresAt)
	if err != nil {
		t.Fatalf("failed to create token: %v", err)
	}

	// Test getting existing token
	retrievedToken, err := repo.GetTokenByValue(ctx, token)
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}
	if retrievedToken == nil {
		t.Fatal("expected token but got nil")
	}
	if retrievedToken.Token != token {
		t.Errorf("expected token '%s' but got '%s'", token, retrievedToken.Token)
	}

	// Test getting non-existent token
	_, err = repo.GetTokenByValue(ctx, "nonexistent-token")
	if err == nil {
		t.Error("expected error for non-existent token but got none")
	}
}

func TestMarkTokenAsUsed(t *testing.T) {
	db := setupTestDB(t)
	repo := NewRepository(db)
	ctx := context.Background()

	token := "test-token-789"
	email := "used@example.com"
	expiresAt := time.Now().Add(1 * time.Hour)

	// Create a token
	createdToken, err := repo.CreateToken(ctx, token, email, expiresAt)
	if err != nil {
		t.Fatalf("failed to create token: %v", err)
	}

	// Mark token as used
	err = repo.MarkTokenAsUsed(ctx, createdToken.UUID.String())
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}

	// Verify token is marked as used
	retrievedToken, err := repo.GetTokenByValue(ctx, token)
	if err != nil {
		t.Fatalf("failed to retrieve token: %v", err)
	}
	if retrievedToken.UsedAt == nil {
		t.Error("expected token to be marked as used but UsedAt is nil")
	}
}

func TestDeleteExpiredTokens(t *testing.T) {
	db := setupTestDB(t)
	repo := NewRepository(db)
	ctx := context.Background()

	// Create an expired token
	expiredToken := "expired-token"
	email := "expired@example.com"
	expiresAt := time.Now().Add(-1 * time.Hour)
	_, err := repo.CreateToken(ctx, expiredToken, email, expiresAt)
	if err != nil {
		t.Fatalf("failed to create expired token: %v", err)
	}

	// Create a valid token
	validToken := "valid-token"
	validExpiresAt := time.Now().Add(1 * time.Hour)
	_, err = repo.CreateToken(ctx, validToken, email, validExpiresAt)
	if err != nil {
		t.Fatalf("failed to create valid token: %v", err)
	}

	// Delete expired tokens
	err = repo.DeleteExpiredTokens(ctx)
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}

	// Verify expired token is deleted
	_, err = repo.GetTokenByValue(ctx, expiredToken)
	if err == nil {
		t.Error("expected error when retrieving deleted token but got none")
	}

	// Verify valid token still exists
	_, err = repo.GetTokenByValue(ctx, validToken)
	if err != nil {
		t.Errorf("valid token should still exist: %v", err)
	}
}

func TestGetActiveTokenByEmail(t *testing.T) {
	db := setupTestDB(t)
	repo := NewRepository(db)
	ctx := context.Background()

	email := "active@example.com"

	// Create an old expired token
	_, err := repo.CreateToken(ctx, "old-token", email, time.Now().Add(-1*time.Hour))
	if err != nil {
		t.Fatalf("failed to create old token: %v", err)
	}

	// Wait a bit to ensure different creation times
	time.Sleep(10 * time.Millisecond)

	// Create a valid token
	validToken := "valid-token"
	_, err = repo.CreateToken(ctx, validToken, email, time.Now().Add(1*time.Hour))
	if err != nil {
		t.Fatalf("failed to create valid token: %v", err)
	}

	// Get active token
	activeToken, err := repo.GetActiveTokenByEmail(ctx, email)
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}
	if activeToken == nil {
		t.Fatal("expected token but got nil")
	}
	if activeToken.Token != validToken {
		t.Errorf("expected token '%s' but got '%s'", validToken, activeToken.Token)
	}
}
