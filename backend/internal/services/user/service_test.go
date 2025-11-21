package user

import (
	"context"
	"testing"

	"github.com/jfxdev/gardarr/internal/infra/database"
	"github.com/jfxdev/gardarr/internal/models"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupTestDB(t *testing.T) *database.Database {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to connect to test database: %v", err)
	}

	// Auto migrate models
	if err := db.AutoMigrate(&models.User{}); err != nil {
		t.Fatalf("failed to migrate test database: %v", err)
	}

	return &database.Database{DB: db}
}

func TestCreateUser(t *testing.T) {
	db := setupTestDB(t)
	service := NewService(db)
	ctx := context.Background()

	tests := []struct {
		name        string
		email       string
		password    string
		expectError bool
		errorMsg    string
	}{
		{
			name:        "Valid user creation",
			email:       "test@example.com",
			password:    "SecurePass123",
			expectError: false,
		},
		{
			name:        "Empty email",
			email:       "",
			password:    "SecurePass123",
			expectError: true,
			errorMsg:    "email is required",
		},
		{
			name:        "Empty password",
			email:       "test2@example.com",
			password:    "",
			expectError: true,
			errorMsg:    "password is required",
		},
		{
			name:        "Short password",
			email:       "test3@example.com",
			password:    "short",
			expectError: true,
			errorMsg:    "password must be at least 8 characters",
		},
		{
			name:        "Duplicate email",
			email:       "test@example.com",
			password:    "AnotherPass123",
			expectError: true,
			errorMsg:    "user with this email already exists",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			user, err := service.CreateUser(ctx, tt.email, tt.password)

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

func TestVerifyPassword(t *testing.T) {
	db := setupTestDB(t)
	service := NewService(db)
	ctx := context.Background()

	email := "verify@example.com"
	password := "CorrectPassword123"

	// Create a user first
	_, err := service.CreateUser(ctx, email, password)
	if err != nil {
		t.Fatalf("failed to create user: %v", err)
	}

	tests := []struct {
		name        string
		email       string
		password    string
		expectError bool
	}{
		{
			name:        "Correct password",
			email:       email,
			password:    password,
			expectError: false,
		},
		{
			name:        "Wrong password",
			email:       email,
			password:    "WrongPassword123",
			expectError: true,
		},
		{
			name:        "Non-existent user",
			email:       "nonexistent@example.com",
			password:    password,
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			user, err := service.VerifyPassword(ctx, tt.email, tt.password)

			if tt.expectError {
				if err == nil {
					t.Errorf("expected error but got none")
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

func TestPasswordHashing(t *testing.T) {
	// Test that same password with different salts produces different hashes
	salt1, err := generateSalt()
	if err != nil {
		t.Fatalf("failed to generate salt1: %v", err)
	}

	salt2, err := generateSalt()
	if err != nil {
		t.Fatalf("failed to generate salt2: %v", err)
	}

	password := "TestPassword123"
	hash1 := hashPassword(password, salt1)
	hash2 := hashPassword(password, salt2)

	if hash1 == hash2 {
		t.Errorf("same password with different salts should produce different hashes")
	}

	// Test that same password with same salt produces same hash
	hash1Again := hashPassword(password, salt1)
	if hash1 != hash1Again {
		t.Errorf("same password with same salt should produce same hash")
	}
}

func TestGetUserByUUID(t *testing.T) {
	db := setupTestDB(t)
	service := NewService(db)
	ctx := context.Background()

	email := "uuid@example.com"
	password := "TestPassword123"

	// Create a user
	createdUser, err := service.CreateUser(ctx, email, password)
	if err != nil {
		t.Fatalf("failed to create user: %v", err)
	}

	// Retrieve user by UUID
	user, err := service.GetUserByUUID(ctx, createdUser.UUID.String())
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}

	if user == nil {
		t.Errorf("expected user but got nil")
	}

	if user != nil && user.UUID != createdUser.UUID {
		t.Errorf("expected UUID '%s' but got '%s'", createdUser.UUID, user.UUID)
	}

	// Try to retrieve non-existent user
	_, err = service.GetUserByUUID(ctx, "00000000-0000-0000-0000-000000000000")
	if err == nil {
		t.Errorf("expected error for non-existent user but got none")
	}
}

func TestDeleteUser(t *testing.T) {
	db := setupTestDB(t)
	service := NewService(db)
	ctx := context.Background()

	// Create regular user
	regularUser, err := service.CreateUser(ctx, "regular@example.com", "SecurePass123")
	if err != nil {
		t.Fatalf("failed to create regular user: %v", err)
	}

	// Create founder user
	founderUser, err := service.CreateUserWithRole(ctx, "founder@example.com", "SecurePass123", "admin", true)
	if err != nil {
		t.Fatalf("failed to create founder user: %v", err)
	}

	tests := []struct {
		name        string
		uuid        string
		expectError bool
		errorMsg    string
	}{
		{
			name:        "Delete founder user - should fail",
			uuid:        founderUser.UUID.String(),
			expectError: true,
			errorMsg:    "founder users cannot be deleted",
		},
		{
			name:        "Delete regular user - should succeed",
			uuid:        regularUser.UUID.String(),
			expectError: false,
		},
		{
			name:        "Delete with empty UUID",
			uuid:        "",
			expectError: true,
			errorMsg:    "uuid is required",
		},
		{
			name:        "Delete non-existent user",
			uuid:        "00000000-0000-0000-0000-000000000000",
			expectError: true,
			errorMsg:    "user not found",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := service.DeleteUser(ctx, tt.uuid)

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

				// Verify user was actually deleted
				_, err := service.GetUserByUUID(ctx, tt.uuid)
				if err == nil {
					t.Errorf("user should have been deleted but still exists")
				}
			}
		})
	}

	// Verify founder user still exists after attempted deletion
	founderCheck, err := service.GetUserByUUID(ctx, founderUser.UUID.String())
	if err != nil {
		t.Errorf("founder user should still exist: %v", err)
	}
	if founderCheck == nil || !founderCheck.Founder {
		t.Errorf("founder user should still exist and have Founder=true")
	}
}
