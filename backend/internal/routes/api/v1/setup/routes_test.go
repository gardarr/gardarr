package setup

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/jfxdev/gardarr/internal/infra/database"
	"github.com/jfxdev/gardarr/internal/models"
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
	if err := db.AutoMigrate(&models.User{}); err != nil {
		t.Fatalf("Failed to migrate test database: %v", err)
	}

	return &database.Database{DB: db}
}

// setupTestRouter creates a test router with the setup routes
func setupTestRouter(t *testing.T) (*gin.Engine, *database.Database) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	db := setupTestDB(t)

	// Create the API v1 group
	v1 := router.Group("/api/v1")

	// Register setup routes
	module := NewModule(v1, db)
	module.Register()

	return router, db
}

// TestRoutes_CheckSetup_NotInitialized tests when no users exist
func TestRoutes_CheckSetup_NotInitialized(t *testing.T) {
	router, _ := setupTestRouter(t)

	req, _ := http.NewRequest("GET", "/api/v1/setup/", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}

	var response map[string]bool
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	initialized, exists := response["initialized"]
	if !exists {
		t.Error("Expected 'initialized' field in response")
	}

	if initialized {
		t.Error("Expected initialized to be false when no users exist")
	}
}

// TestRoutes_CheckSetup_ReturnsJSON tests that the response is valid JSON
func TestRoutes_CheckSetup_ReturnsJSON(t *testing.T) {
	router, _ := setupTestRouter(t)

	req, _ := http.NewRequest("GET", "/api/v1/setup/", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	contentType := w.Header().Get("Content-Type")
	if contentType != "application/json; charset=utf-8" {
		t.Errorf("Expected Content-Type 'application/json; charset=utf-8', got '%s'", contentType)
	}

	var response map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Response is not valid JSON: %v", err)
	}
}

// TestRoutes_CreateAdmin_Success tests successful admin creation
func TestRoutes_CreateAdmin_Success(t *testing.T) {
	router, _ := setupTestRouter(t)

	reqBody := PublicSignupRequest{
		Email:    "admin@example.com",
		Password: "password123",
	}
	body, _ := json.Marshal(reqBody)

	req, _ := http.NewRequest("POST", "/api/v1/setup/", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Errorf("Expected status %d, got %d. Body: %s", http.StatusCreated, w.Code, w.Body.String())
	}

	var response models.AuthResponse
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if response.User.Email != "admin@example.com" {
		t.Errorf("Expected email 'admin@example.com', got '%s'", response.User.Email)
	}
	if response.User.Role != "admin" {
		t.Errorf("Expected role 'admin', got '%s'", response.User.Role)
	}
}

// TestRoutes_CreateAdmin_AlreadyInitialized tests that admin creation fails when system is initialized
func TestRoutes_CreateAdmin_AlreadyInitialized(t *testing.T) {
	router, _ := setupTestRouter(t)

	// Create first admin
	reqBody1 := PublicSignupRequest{
		Email:    "admin1@example.com",
		Password: "password123",
	}
	body1, _ := json.Marshal(reqBody1)
	req1, _ := http.NewRequest("POST", "/api/v1/setup/", bytes.NewBuffer(body1))
	req1.Header.Set("Content-Type", "application/json")
	w1 := httptest.NewRecorder()
	router.ServeHTTP(w1, req1)

	if w1.Code != http.StatusCreated {
		t.Fatalf("Failed to create first admin: %s", w1.Body.String())
	}

	// Try to create second admin
	reqBody2 := PublicSignupRequest{
		Email:    "admin2@example.com",
		Password: "password456",
	}
	body2, _ := json.Marshal(reqBody2)
	req2, _ := http.NewRequest("POST", "/api/v1/setup/", bytes.NewBuffer(body2))
	req2.Header.Set("Content-Type", "application/json")
	w2 := httptest.NewRecorder()
	router.ServeHTTP(w2, req2)

	if w2.Code != http.StatusForbidden {
		t.Errorf("Expected status %d, got %d", http.StatusForbidden, w2.Code)
	}

	var response map[string]string
	if err := json.Unmarshal(w2.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if response["error"] != "System is already initialized" {
		t.Errorf("Expected error about system initialized, got '%s'", response["error"])
	}
}

// TestRoutes_CreateAdmin_InvalidEmail tests validation
func TestRoutes_CreateAdmin_InvalidEmail(t *testing.T) {
	router, _ := setupTestRouter(t)

	reqBody := map[string]string{
		"email":    "invalid-email",
		"password": "password123",
	}
	body, _ := json.Marshal(reqBody)

	req, _ := http.NewRequest("POST", "/api/v1/setup/", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, w.Code)
	}
}

// TestRoutes_CreateAdmin_ShortPassword tests password length validation
func TestRoutes_CreateAdmin_ShortPassword(t *testing.T) {
	router, _ := setupTestRouter(t)

	reqBody := PublicSignupRequest{
		Email:    "admin@example.com",
		Password: "short",
	}
	body, _ := json.Marshal(reqBody)

	req, _ := http.NewRequest("POST", "/api/v1/setup/", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, w.Code)
	}
}

// TestRoutes_CheckSetup_InitializedAfterUserCreation tests that check returns true after creating a user
func TestRoutes_CheckSetup_InitializedAfterUserCreation(t *testing.T) {
	router, _ := setupTestRouter(t)

	// Create admin
	reqBody := PublicSignupRequest{
		Email:    "admin@example.com",
		Password: "password123",
	}
	body, _ := json.Marshal(reqBody)
	req1, _ := http.NewRequest("POST", "/api/v1/setup/", bytes.NewBuffer(body))
	req1.Header.Set("Content-Type", "application/json")
	w1 := httptest.NewRecorder()
	router.ServeHTTP(w1, req1)

	// Check setup status
	req2, _ := http.NewRequest("GET", "/api/v1/setup/", nil)
	w2 := httptest.NewRecorder()
	router.ServeHTTP(w2, req2)

	if w2.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w2.Code)
	}

	var response map[string]bool
	if err := json.Unmarshal(w2.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if !response["initialized"] {
		t.Error("Expected initialized to be true after creating admin")
	}
}
