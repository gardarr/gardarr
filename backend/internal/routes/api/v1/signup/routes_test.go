package signup

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gardarr/gardarr/internal/infra/database"
	"github.com/gardarr/gardarr/internal/models"
	"github.com/gardarr/gardarr/internal/services/auth"
	"github.com/gin-gonic/gin"
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
	if err := db.AutoMigrate(&models.SignupToken{}, &models.User{}, &models.PasswordResetToken{}); err != nil {
		t.Fatalf("Failed to migrate test database: %v", err)
	}

	return &database.Database{DB: db}
}

// setupTestRouter creates a test router with the signup routes
func setupTestRouter(t *testing.T) (*gin.Engine, *database.Database) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	db := setupTestDB(t)

	// Create the API v1 group
	v1 := router.Group("/api/v1")

	// Register signup routes without middleware for testing
	module := NewModule(v1, db)
	signupGroup := v1.Group("/signup")

	signupGroup.POST("/magic_link", module.createMagicLink)
	signupGroup.DELETE("/magic_link/:token", module.revokeMagicLink)
	signupGroup.POST("/verify", module.verifySignup)

	return router, db
}

func TestRoutes_CreateMagicLink_Success(t *testing.T) {
	router, _ := setupTestRouter(t)

	reqBody := models.CreateSignupTokenRequest{
		Role:      "admin",
		ExpiresIn: 24,
		Email:     "invited@example.com",
	}
	body, _ := json.Marshal(reqBody)

	req, _ := http.NewRequest("POST", "/api/v1/signup/magic_link", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Errorf("Expected status %d, got %d", http.StatusCreated, w.Code)
	}

	var response models.SignupTokenResponse
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if response.Token == "" {
		t.Error("Expected token to be generated")
	}
	if response.Role != "admin" {
		t.Errorf("Expected role 'admin', got '%s'", response.Role)
	}
	if response.Email != "invited@example.com" {
		t.Errorf("Expected email 'invited@example.com', got '%s'", response.Email)
	}
	if response.ExpiresAt.IsZero() {
		t.Error("Expected ExpiresAt to be set")
	}
}

func TestRoutes_CreateMagicLink_WithoutEmail(t *testing.T) {
	router, _ := setupTestRouter(t)

	reqBody := models.CreateSignupTokenRequest{
		Role:      "user",
		ExpiresIn: 48,
	}
	body, _ := json.Marshal(reqBody)

	req, _ := http.NewRequest("POST", "/api/v1/signup/magic_link", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Errorf("Expected status %d, got %d", http.StatusCreated, w.Code)
	}

	var response models.SignupTokenResponse
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if response.Token == "" {
		t.Error("Expected token to be generated")
	}
	if response.Role != "user" {
		t.Errorf("Expected role 'user', got '%s'", response.Role)
	}
}

func TestRoutes_CreateMagicLink_InvalidRole(t *testing.T) {
	router, _ := setupTestRouter(t)

	reqBody := models.CreateSignupTokenRequest{
		Role:      "invalid",
		ExpiresIn: 24,
	}
	body, _ := json.Marshal(reqBody)

	req, _ := http.NewRequest("POST", "/api/v1/signup/magic_link", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, w.Code)
	}
}

func TestRoutes_CreateMagicLink_InvalidExpiresIn(t *testing.T) {
	router, _ := setupTestRouter(t)

	reqBody := models.CreateSignupTokenRequest{
		Role:      "user",
		ExpiresIn: 0,
	}
	body, _ := json.Marshal(reqBody)

	req, _ := http.NewRequest("POST", "/api/v1/signup/magic_link", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, w.Code)
	}
}

func TestRoutes_CreateMagicLink_MissingRole(t *testing.T) {
	router, _ := setupTestRouter(t)

	reqBody := models.CreateSignupTokenRequest{
		ExpiresIn: 24,
	}
	body, _ := json.Marshal(reqBody)

	req, _ := http.NewRequest("POST", "/api/v1/signup/magic_link", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, w.Code)
	}
}

func TestRoutes_VerifySignup_Success(t *testing.T) {
	router, db := setupTestRouter(t)

	// Create a magic link token directly via service
	authService := auth.NewService(db)
	token, err := authService.GenerateSignupToken(db.DB.Statement.Context, "admin", 24, "")
	if err != nil {
		t.Fatalf("Failed to generate token: %v", err)
	}

	// Now, use the token to sign up
	verifyReqBody := models.VerifySignupTokenRequest{
		Token:    token.Token,
		Email:    "newuser@example.com",
		Password: "password123",
	}
	verifyBody, _ := json.Marshal(verifyReqBody)

	verifyReq, _ := http.NewRequest("POST", "/api/v1/signup/verify", bytes.NewBuffer(verifyBody))
	verifyReq.Header.Set("Content-Type", "application/json")
	verifyW := httptest.NewRecorder()
	router.ServeHTTP(verifyW, verifyReq)

	if verifyW.Code != http.StatusCreated {
		t.Errorf("Expected status %d, got %d. Body: %s", http.StatusCreated, verifyW.Code, verifyW.Body.String())
	}

	var authResponse models.AuthResponse
	if err := json.Unmarshal(verifyW.Body.Bytes(), &authResponse); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if authResponse.User.Email != "newuser@example.com" {
		t.Errorf("Expected email 'newuser@example.com', got '%s'", authResponse.User.Email)
	}
	if authResponse.User.Role != "admin" {
		t.Errorf("Expected role 'admin', got '%s'", authResponse.User.Role)
	}

	// Verify user was created in database
	var user models.User
	if err := db.DB.Where("email = ?", "newuser@example.com").First(&user).Error; err != nil {
		t.Errorf("User should exist in database: %v", err)
	}
	if user.Role != "admin" {
		t.Errorf("Expected user role 'admin', got '%s'", user.Role)
	}
}

func TestRoutes_VerifySignup_TokenAlreadyUsed(t *testing.T) {
	router, db := setupTestRouter(t)

	// Create a magic link token directly via service
	authService := auth.NewService(db)
	token, err := authService.GenerateSignupToken(db.DB.Statement.Context, "user", 24, "")
	if err != nil {
		t.Fatalf("Failed to generate token: %v", err)
	}

	// Use the token once
	verifyReqBody1 := models.VerifySignupTokenRequest{
		Token:    token.Token,
		Email:    "user1@example.com",
		Password: "password123",
	}
	verifyBody1, _ := json.Marshal(verifyReqBody1)

	verifyReq1, _ := http.NewRequest("POST", "/api/v1/signup/verify", bytes.NewBuffer(verifyBody1))
	verifyReq1.Header.Set("Content-Type", "application/json")
	verifyW1 := httptest.NewRecorder()
	router.ServeHTTP(verifyW1, verifyReq1)

	// Try to use the same token again
	verifyReqBody2 := models.VerifySignupTokenRequest{
		Token:    token.Token,
		Email:    "user2@example.com",
		Password: "password456",
	}
	verifyBody2, _ := json.Marshal(verifyReqBody2)

	verifyReq2, _ := http.NewRequest("POST", "/api/v1/signup/verify", bytes.NewBuffer(verifyBody2))
	verifyReq2.Header.Set("Content-Type", "application/json")
	verifyW2 := httptest.NewRecorder()
	router.ServeHTTP(verifyW2, verifyReq2)

	if verifyW2.Code != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, verifyW2.Code)
	}
}

func TestRoutes_VerifySignup_WithSpecificEmail(t *testing.T) {
	router, db := setupTestRouter(t)

	// Create a magic link token with specific email directly via service
	authService := auth.NewService(db)
	token, err := authService.GenerateSignupToken(db.DB.Statement.Context, "user", 24, "specific@example.com")
	if err != nil {
		t.Fatalf("Failed to generate token: %v", err)
	}

	// Try to use the token with a different email
	verifyReqBody := models.VerifySignupTokenRequest{
		Token:    token.Token,
		Email:    "different@example.com",
		Password: "password123",
	}
	verifyBody, _ := json.Marshal(verifyReqBody)

	verifyReq, _ := http.NewRequest("POST", "/api/v1/signup/verify", bytes.NewBuffer(verifyBody))
	verifyReq.Header.Set("Content-Type", "application/json")
	verifyW := httptest.NewRecorder()
	router.ServeHTTP(verifyW, verifyReq)

	if verifyW.Code != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, verifyW.Code)
	}

	// Try with the correct email
	verifyReqBody2 := models.VerifySignupTokenRequest{
		Token:    token.Token,
		Email:    "specific@example.com",
		Password: "password123",
	}
	verifyBody2, _ := json.Marshal(verifyReqBody2)

	verifyReq2, _ := http.NewRequest("POST", "/api/v1/signup/verify", bytes.NewBuffer(verifyBody2))
	verifyReq2.Header.Set("Content-Type", "application/json")
	verifyW2 := httptest.NewRecorder()
	router.ServeHTTP(verifyW2, verifyReq2)

	if verifyW2.Code != http.StatusCreated {
		t.Errorf("Expected status %d, got %d", http.StatusCreated, verifyW2.Code)
	}
}

func TestRoutes_VerifySignup_InvalidToken(t *testing.T) {
	router, _ := setupTestRouter(t)

	verifyReqBody := models.VerifySignupTokenRequest{
		Token:    "invalid-token-12345",
		Email:    "user@example.com",
		Password: "password123",
	}
	verifyBody, _ := json.Marshal(verifyReqBody)

	verifyReq, _ := http.NewRequest("POST", "/api/v1/signup/verify", bytes.NewBuffer(verifyBody))
	verifyReq.Header.Set("Content-Type", "application/json")
	verifyW := httptest.NewRecorder()
	router.ServeHTTP(verifyW, verifyReq)

	if verifyW.Code != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, verifyW.Code)
	}
}

func TestRoutes_RevokeMagicLink_Success(t *testing.T) {
	router, db := setupTestRouter(t)

	// Create a magic link token directly via service
	authService := auth.NewService(db)
	token, err := authService.GenerateSignupToken(db.DB.Statement.Context, "user", 24, "")
	if err != nil {
		t.Fatalf("Failed to generate token: %v", err)
	}

	// Revoke the token
	req, _ := http.NewRequest("DELETE", "/api/v1/signup/magic_link/"+token.Token, nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}

	var response map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if response["message"] != "Token revoked successfully" {
		t.Errorf("Expected success message, got '%s'", response["message"])
	}

	// Verify token no longer exists
	_, err = authService.GetSignupTokenByValue(db.DB.Statement.Context, token.Token)
	if err == nil {
		t.Error("Expected token to be revoked")
	}
}

func TestRoutes_RevokeMagicLink_NotFound(t *testing.T) {
	router, _ := setupTestRouter(t)

	// Try to revoke non-existent token
	req, _ := http.NewRequest("DELETE", "/api/v1/signup/magic_link/non-existent-token", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("Expected status %d, got %d", http.StatusNotFound, w.Code)
	}
}

func TestRoutes_RevokeMagicLink_CannotUseAfterRevoke(t *testing.T) {
	router, db := setupTestRouter(t)

	// Create a magic link token
	authService := auth.NewService(db)
	token, err := authService.GenerateSignupToken(db.DB.Statement.Context, "admin", 24, "")
	if err != nil {
		t.Fatalf("Failed to generate token: %v", err)
	}

	// Revoke the token
	revokeReq, _ := http.NewRequest("DELETE", "/api/v1/signup/magic_link/"+token.Token, nil)
	revokeW := httptest.NewRecorder()
	router.ServeHTTP(revokeW, revokeReq)

	if revokeW.Code != http.StatusOK {
		t.Errorf("Expected revoke status %d, got %d", http.StatusOK, revokeW.Code)
	}

	// Try to use the revoked token
	verifyReqBody := models.VerifySignupTokenRequest{
		Token:    token.Token,
		Email:    "newuser@example.com",
		Password: "password123",
	}
	verifyBody, _ := json.Marshal(verifyReqBody)

	verifyReq, _ := http.NewRequest("POST", "/api/v1/signup/verify", bytes.NewBuffer(verifyBody))
	verifyReq.Header.Set("Content-Type", "application/json")
	verifyW := httptest.NewRecorder()
	router.ServeHTTP(verifyW, verifyReq)

	if verifyW.Code != http.StatusBadRequest {
		t.Errorf("Expected verify to fail with status %d, got %d", http.StatusBadRequest, verifyW.Code)
	}
}
