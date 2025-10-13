package session

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
	if err := db.AutoMigrate(&models.Session{}, &models.User{}); err != nil {
		t.Fatalf("failed to migrate test database: %v", err)
	}

	return &database.Database{DB: db}
}

func TestCreateSession(t *testing.T) {
	db := setupTestDB(t)
	service := NewService(db)
	ctx := context.Background()

	// Create a test user first
	testUser := &models.User{
		Email:        "test@example.com",
		PasswordHash: "hash",
		Salt:         "salt",
	}
	if err := db.DB.Create(testUser).Error; err != nil {
		t.Fatalf("failed to create test user: %v", err)
	}

	userAgent := "Mozilla/5.0"
	ipAddress := "192.168.1.1"

	session, err := service.CreateSession(ctx, testUser.UUID, userAgent, ipAddress)
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}

	if session == nil {
		t.Fatal("expected session but got nil")
	}

	if session.Token == "" {
		t.Error("expected token to be generated")
	}

	if session.UserUUID != testUser.UUID {
		t.Errorf("expected user UUID '%s' but got '%s'", testUser.UUID, session.UserUUID)
	}

	if session.UserAgent != userAgent {
		t.Errorf("expected user agent '%s' but got '%s'", userAgent, session.UserAgent)
	}
}

func TestValidateSession(t *testing.T) {
	db := setupTestDB(t)
	service := NewService(db)
	ctx := context.Background()

	// Create a test user
	testUser := &models.User{
		Email:        "test@example.com",
		PasswordHash: "hash",
		Salt:         "salt",
	}
	if err := db.DB.Create(testUser).Error; err != nil {
		t.Fatalf("failed to create test user: %v", err)
	}

	// Create session
	session, err := service.CreateSession(ctx, testUser.UUID, "Mozilla/5.0", "192.168.1.1")
	if err != nil {
		t.Fatalf("failed to create session: %v", err)
	}

	// Validate session
	user, sessionEntity, err := service.ValidateSession(ctx, session.Token)
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}

	if user == nil {
		t.Fatal("expected user but got nil")
	}

	if sessionEntity == nil {
		t.Fatal("expected session but got nil")
	}

	if user.UUID != testUser.UUID {
		t.Errorf("expected user UUID '%s' but got '%s'", testUser.UUID, user.UUID)
	}

	// Test invalid token
	_, _, err = service.ValidateSession(ctx, "invalid_token")
	if err == nil {
		t.Error("expected error for invalid token but got none")
	}
}

func TestDeleteSession(t *testing.T) {
	db := setupTestDB(t)
	service := NewService(db)
	ctx := context.Background()

	// Create a test user
	testUser := &models.User{
		Email:        "test@example.com",
		PasswordHash: "hash",
		Salt:         "salt",
	}
	if err := db.DB.Create(testUser).Error; err != nil {
		t.Fatalf("failed to create test user: %v", err)
	}

	// Create session
	session, err := service.CreateSession(ctx, testUser.UUID, "Mozilla/5.0", "192.168.1.1")
	if err != nil {
		t.Fatalf("failed to create session: %v", err)
	}

	// Delete session
	err = service.DeleteSession(ctx, session.Token)
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}

	// Try to validate deleted session
	_, _, err = service.ValidateSession(ctx, session.Token)
	if err == nil {
		t.Error("expected error for deleted session but got none")
	}
}

func TestDeleteUserSessions(t *testing.T) {
	db := setupTestDB(t)
	service := NewService(db)
	ctx := context.Background()

	// Create a test user
	testUser := &models.User{
		Email:        "test@example.com",
		PasswordHash: "hash",
		Salt:         "salt",
	}
	if err := db.DB.Create(testUser).Error; err != nil {
		t.Fatalf("failed to create test user: %v", err)
	}

	// Create multiple sessions
	session1, _ := service.CreateSession(ctx, testUser.UUID, "Chrome", "192.168.1.1")
	session2, _ := service.CreateSession(ctx, testUser.UUID, "Firefox", "192.168.1.2")

	// Delete all user sessions
	err := service.DeleteUserSessions(ctx, testUser.UUID)
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}

	// Validate both sessions should fail
	_, _, err1 := service.ValidateSession(ctx, session1.Token)
	_, _, err2 := service.ValidateSession(ctx, session2.Token)

	if err1 == nil {
		t.Error("expected error for deleted session 1 but got none")
	}

	if err2 == nil {
		t.Error("expected error for deleted session 2 but got none")
	}
}

func TestGetUserSessions(t *testing.T) {
	db := setupTestDB(t)
	service := NewService(db)
	ctx := context.Background()

	// Create a test user
	testUser := &models.User{
		Email:        "test@example.com",
		PasswordHash: "hash",
		Salt:         "salt",
	}
	if err := db.DB.Create(testUser).Error; err != nil {
		t.Fatalf("failed to create test user: %v", err)
	}

	// Create multiple sessions
	_, _ = service.CreateSession(ctx, testUser.UUID, "Chrome", "192.168.1.1")
	_, _ = service.CreateSession(ctx, testUser.UUID, "Firefox", "192.168.1.2")

	// Get all sessions
	sessions, err := service.GetUserSessions(ctx, testUser.UUID)
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}

	if len(sessions) != 2 {
		t.Errorf("expected 2 sessions but got %d", len(sessions))
	}
}

func TestGenerateSessionToken(t *testing.T) {
	token1, err := generateSessionToken()
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}

	token2, err := generateSessionToken()
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}

	if token1 == token2 {
		t.Error("generated tokens should be unique")
	}

	if len(token1) == 0 {
		t.Error("expected non-empty token")
	}
}
