package auth

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
	if err := db.AutoMigrate(&models.User{}, &models.SignupToken{}, &models.PasswordResetToken{}); err != nil {
		t.Fatalf("failed to migrate test database: %v", err)
	}

	return &database.Database{DB: db}
}

// ============================================================================
// SIGNUP TOKEN TESTS
// ============================================================================

func TestGenerateSignupToken(t *testing.T) {
	db := setupTestDB(t)
	service := NewService(db)
	ctx := context.Background()

	tests := []struct {
		name           string
		role           string
		expiresInHours int
		email          string
		expectError    bool
		errorMsg       string
	}{
		{
			name:           "Valid admin token",
			role:           "admin",
			expiresInHours: 24,
			email:          "admin@example.com",
			expectError:    false,
		},
		{
			name:           "Valid user token",
			role:           "user",
			expiresInHours: 48,
			email:          "",
			expectError:    false,
		},
		{
			name:           "Empty role",
			role:           "",
			expiresInHours: 24,
			email:          "",
			expectError:    true,
			errorMsg:       "role is required",
		},
		{
			name:           "Invalid role",
			role:           "superuser",
			expiresInHours: 24,
			email:          "",
			expectError:    true,
			errorMsg:       "invalid role: must be 'admin' or 'user'",
		},
		{
			name:           "Invalid expiration",
			role:           "user",
			expiresInHours: 0,
			email:          "",
			expectError:    true,
			errorMsg:       "expires_in must be at least 1 hour",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			token, err := service.GenerateSignupToken(ctx, tt.role, tt.expiresInHours, tt.email)

			if tt.expectError {
				if err == nil {
					t.Errorf("expected error but got none")
				} else if tt.errorMsg != "" && err.Error() != tt.errorMsg {
					t.Errorf("expected error message '%s' but got '%s'", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Errorf("unexpected error: %v", err)
				}
				if token == nil {
					t.Errorf("expected token but got nil")
				}
				if token != nil {
					if token.Token == "" {
						t.Errorf("expected non-empty token")
					}
					if token.Role != tt.role {
						t.Errorf("expected role '%s' but got '%s'", tt.role, token.Role)
					}
				}
			}
		})
	}
}

func TestValidateAndUseSignupToken(t *testing.T) {
	db := setupTestDB(t)
	service := NewService(db)
	ctx := context.Background()

	// Create a valid signup token
	signupToken, err := service.GenerateSignupToken(ctx, "user", 24, "")
	if err != nil {
		t.Fatalf("failed to generate signup token: %v", err)
	}

	tests := []struct {
		name        string
		token       string
		email       string
		password    string
		expectError bool
		errorMsg    string
	}{
		{
			name:        "Valid token and credentials",
			token:       signupToken.Token,
			email:       "newuser@example.com",
			password:    "SecurePass123",
			expectError: false,
		},
		{
			name:        "Empty token",
			token:       "",
			email:       "test@example.com",
			password:    "password123",
			expectError: true,
			errorMsg:    "token is required",
		},
		{
			name:        "Empty email",
			token:       "some-token",
			email:       "",
			password:    "password123",
			expectError: true,
			errorMsg:    "email is required",
		},
		{
			name:        "Empty password",
			token:       "some-token",
			email:       "test@example.com",
			password:    "",
			expectError: true,
			errorMsg:    "password is required",
		},
		{
			name:        "Invalid token",
			token:       "invalid-token-xyz",
			email:       "test@example.com",
			password:    "password123",
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			user, err := service.ValidateAndUseSignupToken(ctx, tt.token, tt.email, tt.password)

			if tt.expectError {
				if err == nil {
					t.Errorf("expected error but got none")
				} else if tt.errorMsg != "" && err.Error() != tt.errorMsg {
					t.Logf("expected error message '%s' but got '%s'", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Errorf("unexpected error: %v", err)
				}
				if user == nil {
					t.Errorf("expected user but got nil")
				}
				if user != nil && user.Email != tt.email {
					t.Errorf("expected email '%s' but got '%s'", tt.email, user.Email)
				}
			}
		})
	}
}

func TestSignupTokenExpiration(t *testing.T) {
	db := setupTestDB(t)
	service := NewService(db)
	ctx := context.Background()

	// Generate token
	signupToken, err := service.GenerateSignupToken(ctx, "user", 24, "")
	if err != nil {
		t.Fatalf("failed to generate token: %v", err)
	}

	// Manually set token as expired in database
	db.DB.Exec("UPDATE signup_tokens SET expires_at = ? WHERE token = ?",
		time.Now().Add(-1*time.Hour), signupToken.Token)

	// Try to use expired token
	_, err = service.ValidateAndUseSignupToken(ctx, signupToken.Token, "test@example.com", "password123")
	if err == nil {
		t.Error("expected error for expired token but got none")
	}
	if err != nil && err.Error() != "token has expired" && err.Error() != "invalid or expired token" {
		t.Logf("got error: %v", err)
	}
}

func TestSignupTokenReuse(t *testing.T) {
	db := setupTestDB(t)
	service := NewService(db)
	ctx := context.Background()

	// Generate token
	signupToken, err := service.GenerateSignupToken(ctx, "user", 24, "")
	if err != nil {
		t.Fatalf("failed to generate token: %v", err)
	}

	// Use token first time
	_, err = service.ValidateAndUseSignupToken(ctx, signupToken.Token, "user1@example.com", "password123")
	if err != nil {
		t.Fatalf("first use should succeed: %v", err)
	}

	// Try to reuse token
	_, err = service.ValidateAndUseSignupToken(ctx, signupToken.Token, "user2@example.com", "password456")
	if err == nil {
		t.Error("expected error for reused token but got none")
	}
	if err != nil && err.Error() != "token has already been used" && err.Error() != "invalid or expired token" {
		t.Logf("got error: %v", err)
	}
}

func TestListSignupTokens(t *testing.T) {
	db := setupTestDB(t)
	service := NewService(db)
	ctx := context.Background()

	// Generate multiple tokens
	_, err := service.GenerateSignupToken(ctx, "admin", 24, "admin@example.com")
	if err != nil {
		t.Fatalf("failed to generate token 1: %v", err)
	}

	_, err = service.GenerateSignupToken(ctx, "user", 48, "")
	if err != nil {
		t.Fatalf("failed to generate token 2: %v", err)
	}

	// List tokens
	tokens, err := service.ListSignupTokens(ctx)
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}
	if len(tokens) != 2 {
		t.Errorf("expected 2 tokens but got %d", len(tokens))
	}
}

func TestRevokeSignupToken(t *testing.T) {
	db := setupTestDB(t)
	service := NewService(db)
	ctx := context.Background()

	// Generate token
	token, err := service.GenerateSignupToken(ctx, "user", 24, "")
	if err != nil {
		t.Fatalf("failed to generate token: %v", err)
	}

	// Revoke token
	err = service.RevokeSignupToken(ctx, token.Token)
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}

	// Try to retrieve revoked token
	_, err = service.GetSignupTokenByValue(ctx, token.Token)
	if err == nil {
		t.Error("expected error for revoked token but got none")
	}
}

// ============================================================================
// PASSWORD RESET TESTS
// ============================================================================

func TestGeneratePasswordResetToken(t *testing.T) {
	db := setupTestDB(t)
	service := NewService(db)
	ctx := context.Background()

	// Create a test user first
	email := "test@example.com"
	password := "TestPassword123"
	_, err := service.userService.CreateUser(ctx, email, password)
	if err != nil {
		t.Fatalf("failed to create user: %v", err)
	}

	tests := []struct {
		name        string
		email       string
		expectError bool
		errorMsg    string
	}{
		{
			name:        "Valid email",
			email:       email,
			expectError: false,
		},
		{
			name:        "Empty email",
			email:       "",
			expectError: true,
			errorMsg:    "email is required",
		},
		{
			name:        "Non-existent user",
			email:       "nonexistent@example.com",
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			token, err := service.GeneratePasswordResetToken(ctx, tt.email)

			if tt.expectError {
				if err == nil {
					t.Errorf("expected error but got none")
				} else if tt.errorMsg != "" && err.Error() != tt.errorMsg {
					t.Logf("expected error message '%s' but got '%s'", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Errorf("unexpected error: %v", err)
				}
				if token == nil {
					t.Errorf("expected token but got nil")
				}
				if token != nil {
					if token.Token == "" {
						t.Errorf("expected non-empty token")
					}
					if token.Email != tt.email {
						t.Errorf("expected email '%s' but got '%s'", tt.email, token.Email)
					}
					if token.ExpiresAt.Before(time.Now()) {
						t.Errorf("token should not be expired immediately after creation")
					}
				}
			}
		})
	}
}

func TestValidateAndResetPassword(t *testing.T) {
	db := setupTestDB(t)
	service := NewService(db)
	ctx := context.Background()

	// Create a test user
	email := "reset@example.com"
	oldPassword := "OldPassword123"
	newPassword := "NewPassword456"

	_, err := service.userService.CreateUser(ctx, email, oldPassword)
	if err != nil {
		t.Fatalf("failed to create user: %v", err)
	}

	// Generate a valid token
	resetToken, err := service.GeneratePasswordResetToken(ctx, email)
	if err != nil {
		t.Fatalf("failed to generate token: %v", err)
	}

	tests := []struct {
		name        string
		token       string
		newPassword string
		expectError bool
		errorMsg    string
	}{
		{
			name:        "Valid token and password",
			token:       resetToken.Token,
			newPassword: newPassword,
			expectError: false,
		},
		{
			name:        "Empty token",
			token:       "",
			newPassword: newPassword,
			expectError: true,
			errorMsg:    "token is required",
		},
		{
			name:        "Empty password",
			token:       "some-token",
			newPassword: "",
			expectError: true,
			errorMsg:    "new password is required",
		},
		{
			name:        "Short password",
			token:       "some-token",
			newPassword: "short",
			expectError: true,
			errorMsg:    "password must be at least 8 characters",
		},
		{
			name:        "Invalid token",
			token:       "invalid-token-xyz",
			newPassword: newPassword,
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := service.ValidateAndResetPassword(ctx, tt.token, tt.newPassword)

			if tt.expectError {
				if err == nil {
					t.Errorf("expected error but got none")
				} else if tt.errorMsg != "" && err.Error() != tt.errorMsg {
					t.Logf("expected error message '%s' but got '%s'", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Errorf("unexpected error: %v", err)
				}

				// Verify password was changed
				_, err := service.userService.VerifyPassword(ctx, email, newPassword)
				if err != nil {
					t.Errorf("new password should work: %v", err)
				}

				// Verify old password no longer works
				_, err = service.userService.VerifyPassword(ctx, email, oldPassword)
				if err == nil {
					t.Errorf("old password should not work anymore")
				}

				// Verify token is marked as used
				retrievedToken, err := service.GetPasswordResetTokenByValue(ctx, tt.token)
				if err != nil {
					t.Errorf("failed to retrieve token: %v", err)
				}
				if retrievedToken != nil && !retrievedToken.IsUsed() {
					t.Errorf("token should be marked as used")
				}
			}
		})
	}
}

func TestPasswordResetTokenExpiration(t *testing.T) {
	db := setupTestDB(t)
	service := NewService(db)
	ctx := context.Background()

	// Create a test user
	email := "expire@example.com"
	password := "TestPassword123"
	_, err := service.userService.CreateUser(ctx, email, password)
	if err != nil {
		t.Fatalf("failed to create user: %v", err)
	}

	// Generate token
	resetToken, err := service.GeneratePasswordResetToken(ctx, email)
	if err != nil {
		t.Fatalf("failed to generate token: %v", err)
	}

	// Manually set token as expired in database
	db.DB.Exec("UPDATE password_reset_tokens SET expires_at = ? WHERE token = ?",
		time.Now().Add(-1*time.Hour), resetToken.Token)

	// Try to use expired token
	err = service.ValidateAndResetPassword(ctx, resetToken.Token, "NewPassword789")
	if err == nil {
		t.Error("expected error for expired token but got none")
	}
	if err != nil && err.Error() != "token has expired" && err.Error() != "invalid or expired token" {
		t.Logf("got error: %v", err)
	}
}

func TestPasswordResetTokenReuse(t *testing.T) {
	db := setupTestDB(t)
	service := NewService(db)
	ctx := context.Background()

	// Create a test user
	email := "reuse@example.com"
	password := "TestPassword123"
	_, err := service.userService.CreateUser(ctx, email, password)
	if err != nil {
		t.Fatalf("failed to create user: %v", err)
	}

	// Generate token
	resetToken, err := service.GeneratePasswordResetToken(ctx, email)
	if err != nil {
		t.Fatalf("failed to generate token: %v", err)
	}

	// Use token first time
	err = service.ValidateAndResetPassword(ctx, resetToken.Token, "NewPassword456")
	if err != nil {
		t.Fatalf("first use should succeed: %v", err)
	}

	// Try to reuse token
	err = service.ValidateAndResetPassword(ctx, resetToken.Token, "AnotherPassword789")
	if err == nil {
		t.Error("expected error for reused token but got none")
	}
	if err != nil && err.Error() != "token has already been used" && err.Error() != "invalid or expired token" {
		t.Logf("got error: %v", err)
	}
}

func TestRevokePasswordResetTokensByEmail(t *testing.T) {
	db := setupTestDB(t)
	service := NewService(db)
	ctx := context.Background()

	// Create test user
	email := "revoke@example.com"
	password := "TestPassword123"
	_, err := service.userService.CreateUser(ctx, email, password)
	if err != nil {
		t.Fatalf("failed to create user: %v", err)
	}

	// Generate token
	token, err := service.GeneratePasswordResetToken(ctx, email)
	if err != nil {
		t.Fatalf("failed to generate token: %v", err)
	}

	// Verify token exists
	_, err = service.GetPasswordResetTokenByValue(ctx, token.Token)
	if err != nil {
		t.Errorf("token should exist: %v", err)
	}

	// Revoke all tokens for the email
	err = service.RevokePasswordResetTokensByEmail(ctx, email)
	if err != nil {
		t.Errorf("revoke failed: %v", err)
	}

	// Verify token is deleted
	_, err = service.GetPasswordResetTokenByValue(ctx, token.Token)
	if err == nil {
		t.Error("token should be deleted after revoke")
	}
}

// ============================================================================
// CLEANUP TESTS
// ============================================================================

func TestCleanupExpiredSignupTokens(t *testing.T) {
	db := setupTestDB(t)
	service := NewService(db)
	ctx := context.Background()

	// Create an expired token
	expiredToken, err := service.GenerateSignupToken(ctx, "user", 24, "")
	if err != nil {
		t.Fatalf("failed to generate expired token: %v", err)
	}

	// Create a valid token
	validToken, err := service.GenerateSignupToken(ctx, "user", 24, "")
	if err != nil {
		t.Fatalf("failed to generate valid token: %v", err)
	}

	// Set first token as expired
	db.DB.Exec("UPDATE signup_tokens SET expires_at = ? WHERE token = ?",
		time.Now().Add(-1*time.Hour), expiredToken.Token)

	// Cleanup expired tokens
	err = service.CleanupExpiredSignupTokens(ctx)
	if err != nil {
		t.Errorf("cleanup failed: %v", err)
	}

	// Verify expired token is deleted
	_, err = service.GetSignupTokenByValue(ctx, expiredToken.Token)
	if err == nil {
		t.Error("expired token should be deleted")
	}

	// Verify valid token still exists
	_, err = service.GetSignupTokenByValue(ctx, validToken.Token)
	if err != nil {
		t.Errorf("valid token should still exist: %v", err)
	}
}

func TestCleanupExpiredPasswordResetTokens(t *testing.T) {
	db := setupTestDB(t)
	service := NewService(db)
	ctx := context.Background()

	// Create test users
	email1 := "cleanup1@example.com"
	email2 := "cleanup2@example.com"
	password := "TestPassword123"

	_, err := service.userService.CreateUser(ctx, email1, password)
	if err != nil {
		t.Fatalf("failed to create user1: %v", err)
	}
	_, err = service.userService.CreateUser(ctx, email2, password)
	if err != nil {
		t.Fatalf("failed to create user2: %v", err)
	}

	// Generate valid and expired tokens
	validToken, err := service.GeneratePasswordResetToken(ctx, email1)
	if err != nil {
		t.Fatalf("failed to generate valid token: %v", err)
	}

	expiredToken, err := service.GeneratePasswordResetToken(ctx, email2)
	if err != nil {
		t.Fatalf("failed to generate token to be expired: %v", err)
	}

	// Set second token as expired
	db.DB.Exec("UPDATE password_reset_tokens SET expires_at = ? WHERE token = ?",
		time.Now().Add(-1*time.Hour), expiredToken.Token)

	// Cleanup expired tokens
	err = service.CleanupExpiredPasswordResetTokens(ctx)
	if err != nil {
		t.Errorf("cleanup failed: %v", err)
	}

	// Verify expired token is deleted
	_, err = service.GetPasswordResetTokenByValue(ctx, expiredToken.Token)
	if err == nil {
		t.Error("expired token should be deleted")
	}

	// Verify valid token still exists
	_, err = service.GetPasswordResetTokenByValue(ctx, validToken.Token)
	if err != nil {
		t.Errorf("valid token should still exist: %v", err)
	}
}

func TestCleanupAllExpiredTokens(t *testing.T) {
	db := setupTestDB(t)
	service := NewService(db)
	ctx := context.Background()

	// Create a test user for password reset
	email := "cleanup@example.com"
	password := "TestPassword123"
	_, err := service.userService.CreateUser(ctx, email, password)
	if err != nil {
		t.Fatalf("failed to create user: %v", err)
	}

	// Generate expired signup token
	expiredSignupToken, err := service.GenerateSignupToken(ctx, "user", 24, "")
	if err != nil {
		t.Fatalf("failed to generate signup token: %v", err)
	}
	db.DB.Exec("UPDATE signup_tokens SET expires_at = ? WHERE token = ?",
		time.Now().Add(-1*time.Hour), expiredSignupToken.Token)

	// Generate expired password reset token
	expiredResetToken, err := service.GeneratePasswordResetToken(ctx, email)
	if err != nil {
		t.Fatalf("failed to generate reset token: %v", err)
	}
	db.DB.Exec("UPDATE password_reset_tokens SET expires_at = ? WHERE token = ?",
		time.Now().Add(-1*time.Hour), expiredResetToken.Token)

	// Cleanup all expired tokens
	err = service.CleanupAllExpiredTokens(ctx)
	if err != nil {
		t.Errorf("cleanup failed: %v", err)
	}

	// Verify both tokens are deleted
	_, err = service.GetSignupTokenByValue(ctx, expiredSignupToken.Token)
	if err == nil {
		t.Error("expired signup token should be deleted")
	}

	_, err = service.GetPasswordResetTokenByValue(ctx, expiredResetToken.Token)
	if err == nil {
		t.Error("expired reset token should be deleted")
	}
}
