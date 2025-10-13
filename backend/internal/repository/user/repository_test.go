package user

import (
	"context"
	"testing"

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
	if err := db.AutoMigrate(&models.User{}); err != nil {
		t.Fatalf("failed to migrate test database: %v", err)
	}

	return &database.Database{DB: db}
}

func TestCreateUser(t *testing.T) {
	db := setupTestDB(t)
	repo := NewRepository(db)
	ctx := context.Background()

	tests := []struct {
		name         string
		email        string
		passwordHash string
		salt         string
		expectError  bool
		errorMsg     string
	}{
		{
			name:         "Valid user creation",
			email:        "test@example.com",
			passwordHash: "hashedpassword123",
			salt:         "salt123",
			expectError:  false,
		},
		{
			name:         "Duplicate email",
			email:        "test@example.com",
			passwordHash: "hashedpassword456",
			salt:         "salt456",
			expectError:  true,
			errorMsg:     "user with this email already exists",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			user, err := repo.CreateUser(ctx, tt.email, tt.passwordHash, tt.salt)

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

func TestGetUserByEmail(t *testing.T) {
	db := setupTestDB(t)
	repo := NewRepository(db)
	ctx := context.Background()

	email := "get@example.com"
	passwordHash := "hashedpassword"
	salt := "salt"

	// Create a user
	_, err := repo.CreateUser(ctx, email, passwordHash, salt)
	if err != nil {
		t.Fatalf("failed to create user: %v", err)
	}

	// Test getting existing user
	user, err := repo.GetUserByEmail(ctx, email)
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}
	if user == nil {
		t.Errorf("expected user but got nil")
	}
	if user != nil && user.Email != email {
		t.Errorf("expected email '%s' but got '%s'", email, user.Email)
	}

	// Test getting non-existent user
	_, err = repo.GetUserByEmail(ctx, "nonexistent@example.com")
	if err == nil {
		t.Errorf("expected error for non-existent user but got none")
	}
}

func TestGetUserByUUID(t *testing.T) {
	db := setupTestDB(t)
	repo := NewRepository(db)
	ctx := context.Background()

	email := "uuid@example.com"
	passwordHash := "hashedpassword"
	salt := "salt"

	// Create a user
	createdUser, err := repo.CreateUser(ctx, email, passwordHash, salt)
	if err != nil {
		t.Fatalf("failed to create user: %v", err)
	}

	// Test getting existing user
	user, err := repo.GetUserByUUID(ctx, createdUser.UUID.String())
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}
	if user == nil {
		t.Errorf("expected user but got nil")
	}
	if user != nil && user.UUID != createdUser.UUID {
		t.Errorf("expected UUID '%s' but got '%s'", createdUser.UUID, user.UUID)
	}

	// Test getting non-existent user
	_, err = repo.GetUserByUUID(ctx, "00000000-0000-0000-0000-000000000000")
	if err == nil {
		t.Errorf("expected error for non-existent user but got none")
	}
}
