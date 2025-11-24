package signup_token

import (
	"context"
	"testing"
	"time"

	"github.com/jfxdev/gardarr/internal/infra/database"
	"github.com/jfxdev/gardarr/internal/models"
)

func TestRepositoryCreateToken(t *testing.T) {
	db := database.SetupTestDB(t, &models.SignupToken{})
	repo := NewRepository(db)
	ctx := context.Background()

	token := "test-token-123"
	email := "test@example.com"
	role := "admin"
	expiresAt := time.Now().Add(24 * time.Hour)

	result, err := repo.CreateToken(ctx, token, email, role, expiresAt)
	if err != nil {
		t.Fatalf("Failed to create token: %v", err)
	}

	if result.Token != token {
		t.Errorf("Expected token %s, got %s", token, result.Token)
	}
	if result.Email != email {
		t.Errorf("Expected email %s, got %s", email, result.Email)
	}
	if result.Role != role {
		t.Errorf("Expected role %s, got %s", role, result.Role)
	}
}

func TestRepositoryGetTokenByValue(t *testing.T) {
	db := database.SetupTestDB(t, &models.SignupToken{})
	repo := NewRepository(db)
	ctx := context.Background()

	token := "test-token-456"
	expiresAt := time.Now().Add(24 * time.Hour)

	// Create a token first
	_, err := repo.CreateToken(ctx, token, "test@example.com", "user", expiresAt)
	if err != nil {
		t.Fatalf("Failed to create token: %v", err)
	}

	// Retrieve the token
	result, err := repo.GetTokenByValue(ctx, token)
	if err != nil {
		t.Fatalf("Failed to get token: %v", err)
	}

	if result.Token != token {
		t.Errorf("Expected token %s, got %s", token, result.Token)
	}
}

func TestRepositoryGetTokenByValue_NotFound(t *testing.T) {
	db := database.SetupTestDB(t, &models.SignupToken{})
	repo := NewRepository(db)
	ctx := context.Background()

	_, err := repo.GetTokenByValue(ctx, "non-existent-token")
	if err == nil {
		t.Error("Expected error for non-existent token")
	}
	if err.Error() != "token not found" {
		t.Errorf("Expected 'token not found' error, got: %v", err)
	}
}

func TestRepositoryMarkTokenAsUsed(t *testing.T) {
	db := database.SetupTestDB(t, &models.SignupToken{})
	repo := NewRepository(db)
	ctx := context.Background()

	token := "test-token-789"
	expiresAt := time.Now().Add(24 * time.Hour)

	// Create a token
	created, err := repo.CreateToken(ctx, token, "test@example.com", "user", expiresAt)
	if err != nil {
		t.Fatalf("Failed to create token: %v", err)
	}

	// Mark as used
	err = repo.MarkTokenAsUsed(ctx, created.UUID.String())
	if err != nil {
		t.Fatalf("Failed to mark token as used: %v", err)
	}

	// Verify it's marked as used
	result, err := repo.GetTokenByValue(ctx, token)
	if err != nil {
		t.Fatalf("Failed to get token: %v", err)
	}

	if result.UsedAt == nil {
		t.Error("Expected UsedAt to be set")
	}
}

func TestRepositoryDeleteExpiredTokens(t *testing.T) {
	db := database.SetupTestDB(t, &models.SignupToken{})
	repo := NewRepository(db)
	ctx := context.Background()

	// Create an expired token
	expiredToken := "expired-token"
	expiresAt := time.Now().Add(-1 * time.Hour)
	_, err := repo.CreateToken(ctx, expiredToken, "expired@example.com", "user", expiresAt)
	if err != nil {
		t.Fatalf("Failed to create expired token: %v", err)
	}

	// Create a valid token
	validToken := "valid-token"
	validExpiresAt := time.Now().Add(24 * time.Hour)
	_, err = repo.CreateToken(ctx, validToken, "valid@example.com", "user", validExpiresAt)
	if err != nil {
		t.Fatalf("Failed to create valid token: %v", err)
	}

	// Delete expired tokens
	err = repo.DeleteExpiredTokens(ctx)
	if err != nil {
		t.Fatalf("Failed to delete expired tokens: %v", err)
	}

	// Verify expired token is gone
	_, err = repo.GetTokenByValue(ctx, expiredToken)
	if err == nil {
		t.Error("Expected expired token to be deleted")
	}

	// Verify valid token still exists
	_, err = repo.GetTokenByValue(ctx, validToken)
	if err != nil {
		t.Errorf("Valid token should still exist: %v", err)
	}
}

func TestRepositoryDeleteToken(t *testing.T) {
	db := database.SetupTestDB(t, &models.SignupToken{})
	repo := NewRepository(db)
	ctx := context.Background()

	token := "token-to-delete"
	expiresAt := time.Now().Add(24 * time.Hour)

	// Create a token
	_, err := repo.CreateToken(ctx, token, "test@example.com", "user", expiresAt)
	if err != nil {
		t.Fatalf("Failed to create token: %v", err)
	}

	// Delete the token
	err = repo.DeleteToken(ctx, token)
	if err != nil {
		t.Fatalf("Failed to delete token: %v", err)
	}

	// Verify token is gone
	_, err = repo.GetTokenByValue(ctx, token)
	if err == nil {
		t.Error("Expected token to be deleted")
	}
}

func TestRepositoryDeleteToken_NotFound(t *testing.T) {
	db := database.SetupTestDB(t, &models.SignupToken{})
	repo := NewRepository(db)
	ctx := context.Background()

	// Try to delete non-existent token
	err := repo.DeleteToken(ctx, "non-existent-token")
	if err == nil {
		t.Error("Expected error when deleting non-existent token")
	}
	if err.Error() != "token not found" {
		t.Errorf("Expected 'token not found' error, got: %v", err)
	}
}
