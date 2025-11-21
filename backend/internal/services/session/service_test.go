package session

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jfxdev/gardarr/internal/infra/database"
	"github.com/jfxdev/gardarr/internal/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// setupTestDB creates an in-memory SQLite database for testing
func setupTestDB(t *testing.T) *database.Database {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to create test database: %v", err)
	}

	// Run migrations
	if err := db.AutoMigrate(&models.Session{}, &models.User{}); err != nil {
		t.Fatalf("Failed to migrate test database: %v", err)
	}

	return &database.Database{DB: db}
}

func TestValidateSession_ReturnsUserWithRole(t *testing.T) {
	// Setup test database
	db := setupTestDB(t)

	// Create test user
	userUUID := uuid.New()
	userModel := &models.User{
		UUID:         userUUID,
		Email:        "admin@example.com",
		PasswordHash: "hashed_password",
		Salt:         "salt",
		Role:         "admin",
		Founder:      true,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	// Create user in database
	err := db.DB.Create(userModel).Error
	require.NoError(t, err)

	// Create test session
	sessionToken := "test_session_token"
	sessionModel := &models.Session{
		UserUUID:  userUUID,
		Token:     sessionToken,
		Role:      "admin",
		UserAgent: "test-agent",
		IPAddress: "127.0.0.1",
		ExpiresAt: time.Now().Add(24 * time.Hour),
		CreatedAt: time.Now(),
	}

	// Create session in database
	err = db.DB.Create(sessionModel).Error
	require.NoError(t, err)

	// Create service
	service := NewService(db)

	// Test ValidateSession
	user, session, err := service.ValidateSession(context.Background(), sessionToken)

	// Assertions
	require.NoError(t, err)
	require.NotNil(t, user)
	require.NotNil(t, session)

	// Verify user has role
	assert.Equal(t, "admin", user.Role)
	assert.Equal(t, "admin@example.com", user.Email)
	assert.Equal(t, userUUID, user.UUID)
	assert.True(t, user.Founder)

	// Verify session
	assert.Equal(t, sessionToken, session.Token)
	assert.Equal(t, "admin", session.Role)
}

func TestValidateSession_ReturnsUserWithUserRole(t *testing.T) {
	// Setup test database
	db := setupTestDB(t)

	// Create test user with user role
	userUUID := uuid.New()
	userModel := &models.User{
		UUID:         userUUID,
		Email:        "user@example.com",
		PasswordHash: "hashed_password",
		Salt:         "salt",
		Role:         "user",
		Founder:      false,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	// Create user in database
	err := db.DB.Create(userModel).Error
	require.NoError(t, err)

	// Create test session
	sessionToken := "test_session_token"
	sessionModel := &models.Session{
		UserUUID:  userUUID,
		Token:     sessionToken,
		Role:      "user",
		UserAgent: "test-agent",
		IPAddress: "127.0.0.1",
		ExpiresAt: time.Now().Add(24 * time.Hour),
		CreatedAt: time.Now(),
	}

	// Create session in database
	err = db.DB.Create(sessionModel).Error
	require.NoError(t, err)

	// Create service
	service := NewService(db)

	// Test ValidateSession
	user, session, err := service.ValidateSession(context.Background(), sessionToken)

	// Assertions
	require.NoError(t, err)
	require.NotNil(t, user)
	require.NotNil(t, session)

	// Verify user has role
	assert.Equal(t, "user", user.Role)
	assert.Equal(t, "user@example.com", user.Email)
	assert.Equal(t, userUUID, user.UUID)
	assert.False(t, user.Founder)

	// Verify session
	assert.Equal(t, sessionToken, session.Token)
	assert.Equal(t, "user", session.Role)
}
