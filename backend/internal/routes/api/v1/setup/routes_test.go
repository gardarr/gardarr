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
)

// setupTestRouter creates a test router with the setup routes
func setupTestRouter(t *testing.T) (*gin.Engine, *database.Database) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	db := database.SetupTestDBWithCache(t, &models.User{})

	// Create the API v1 group
	v1 := router.Group("/api/v1")

	// Register setup routes
	module := NewModule(v1, db)
	module.Register()

	return router, db
}

// TestRoutesCheckSetupNotInitialized tests when no users exist
func TestRoutesCheckSetupNotInitialized(t *testing.T) {
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

// TestRoutesCheckSetupReturnsJSON tests that the response is valid JSON
func TestRoutesCheckSetupReturnsJSON(t *testing.T) {
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

// TestRoutesCreateAdminSuccess tests successful admin creation
func TestRoutesCreateAdminSuccess(t *testing.T) {
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

// TestRoutesCreateAdminAlreadyInitialized tests that admin creation fails when system is initialized
func TestRoutesCreateAdminAlreadyInitialized(t *testing.T) {
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

// TestRoutesCreateAdminInvalidEmail tests validation
func TestRoutesCreateAdminInvalidEmail(t *testing.T) {
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

// TestRoutesCreateAdminShortPassword tests password length validation
func TestRoutesCreateAdminShortPassword(t *testing.T) {
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

// TestRoutesCheckSetupInitializedAfterUserCreation tests that check returns true after creating a user
func TestRoutesCheckSetupInitializedAfterUserCreation(t *testing.T) {
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
