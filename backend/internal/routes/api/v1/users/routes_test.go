package users

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jfxdev/gardarr/internal/infra/database"
	"github.com/jfxdev/gardarr/internal/models"
	"github.com/jfxdev/gardarr/internal/services/user"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// setupTestRouter creates a test router with the users routes
func setupTestRouter(t *testing.T) (*gin.Engine, *database.Database) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	db := database.SetupTestDBWithCache(t, &models.User{}, &models.Session{}, &models.PasswordResetToken{})

	// Create the API v1 group
	v1 := router.Group("/api/v1")

	// Register users routes without middleware for testing
	module := NewModule(v1, db)
	usersGroup := v1.Group("/users")

	usersGroup.GET("/", module.listUsers)
	usersGroup.DELETE("/:uuid", module.deleteUser)
	usersGroup.POST("/:uuid/password/request_reset", module.requestPasswordReset)

	return router, db
}

// createTestUser is a helper function to create a test user
func createTestUser(t *testing.T, db *database.Database, email string) *models.User {
	userService := user.NewService(db)
	entity, err := userService.CreateUser(db.DB.Statement.Context, email, "password123")
	if err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}

	var model models.User
	if err := db.DB.Where("uuid = ?", entity.UUID).First(&model).Error; err != nil {
		t.Fatalf("Failed to fetch created user: %v", err)
	}

	return &model
}

func TestRoutesListUsersSuccess(t *testing.T) {
	router, db := setupTestRouter(t)

	// Create some test users
	createTestUser(t, db, "user1@example.com")
	createTestUser(t, db, "user2@example.com")
	createTestUser(t, db, "user3@example.com")

	// List all users
	req, _ := http.NewRequest("GET", "/api/v1/users/", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}

	var response models.ListUsersResponse
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if response.Total != 3 {
		t.Errorf("Expected total 3, got %d", response.Total)
	}

	if len(response.Users) != 3 {
		t.Errorf("Expected 3 users, got %d", len(response.Users))
	}

	// Check that responses don't contain sensitive data
	for _, user := range response.Users {
		if user.UUID == "" {
			t.Error("Expected UUID to be populated")
		}
		if user.Email == "" {
			t.Error("Expected Email to be populated")
		}
		if user.Role == "" {
			t.Error("Expected Role to be populated")
		}
		if user.CreatedAt.IsZero() {
			t.Error("Expected CreatedAt to be populated")
		}
	}
}

func TestRoutesListUsersEmpty(t *testing.T) {
	router, _ := setupTestRouter(t)

	// List users when database is empty
	req, _ := http.NewRequest("GET", "/api/v1/users/", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}

	var response models.ListUsersResponse
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if response.Total != 0 {
		t.Errorf("Expected total 0, got %d", response.Total)
	}

	if len(response.Users) != 0 {
		t.Errorf("Expected 0 users, got %d", len(response.Users))
	}
}

func TestRoutesListUsersOrderedByCreatedAt(t *testing.T) {
	router, db := setupTestRouter(t)

	// Create users in a specific order
	user1 := createTestUser(t, db, "first@example.com")
	user2 := createTestUser(t, db, "second@example.com")
	user3 := createTestUser(t, db, "third@example.com")

	// List all users
	req, _ := http.NewRequest("GET", "/api/v1/users/", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}

	var response models.ListUsersResponse
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	// Should be ordered by created_at DESC (most recent first)
	if response.Users[0].Email != user3.Email {
		t.Errorf("Expected first user to be %s, got %s", user3.Email, response.Users[0].Email)
	}
	if response.Users[1].Email != user2.Email {
		t.Errorf("Expected second user to be %s, got %s", user2.Email, response.Users[1].Email)
	}
	if response.Users[2].Email != user1.Email {
		t.Errorf("Expected third user to be %s, got %s", user1.Email, response.Users[2].Email)
	}
}

func TestRoutesDeleteUserSuccess(t *testing.T) {
	router, db := setupTestRouter(t)

	// Create a test user
	user := createTestUser(t, db, "delete@example.com")

	// Delete the user
	req, _ := http.NewRequest("DELETE", "/api/v1/users/"+user.UUID.String(), nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
	}

	var response map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if response["message"] != "User deleted successfully" {
		t.Errorf("Expected success message, got '%s'", response["message"])
	}

	// Verify user was deleted
	var count int64
	db.DB.Model(&models.User{}).Where("uuid = ?", user.UUID).Count(&count)
	if count != 0 {
		t.Error("User should have been deleted from database")
	}
}

func TestRoutesDeleteUserNotFound(t *testing.T) {
	router, _ := setupTestRouter(t)

	// Try to delete non-existent user
	req, _ := http.NewRequest("DELETE", "/api/v1/users/00000000-0000-0000-0000-000000000000", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("Expected status %d, got %d", http.StatusNotFound, w.Code)
	}

	var response map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if response["error"] != "User not found" {
		t.Errorf("Expected 'User not found' error, got '%s'", response["error"])
	}
}

func TestRoutesDeleteUserInvalidUUID(t *testing.T) {
	router, _ := setupTestRouter(t)

	// Try to delete with invalid UUID format
	req, _ := http.NewRequest("DELETE", "/api/v1/users/invalid-uuid", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Should still try to process and return not found
	if w.Code != http.StatusNotFound {
		t.Errorf("Expected status %d, got %d", http.StatusNotFound, w.Code)
	}
}

func TestRoutesDeleteUserVerifyListAfterDelete(t *testing.T) {
	router, db := setupTestRouter(t)

	// Create three users
	user1 := createTestUser(t, db, "user1@example.com")
	createTestUser(t, db, "user2@example.com")
	createTestUser(t, db, "user3@example.com")

	// Delete first user
	reqDelete, _ := http.NewRequest("DELETE", "/api/v1/users/"+user1.UUID.String(), nil)
	wDelete := httptest.NewRecorder()
	router.ServeHTTP(wDelete, reqDelete)

	if wDelete.Code != http.StatusOK {
		t.Fatalf("Failed to delete user: %s", wDelete.Body.String())
	}

	// List users and verify only 2 remain
	reqList, _ := http.NewRequest("GET", "/api/v1/users/", nil)
	wList := httptest.NewRecorder()
	router.ServeHTTP(wList, reqList)

	var response models.ListUsersResponse
	if err := json.Unmarshal(wList.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if response.Total != 2 {
		t.Errorf("Expected total 2, got %d", response.Total)
	}

	// Verify deleted user is not in list
	for _, user := range response.Users {
		if user.Email == "user1@example.com" {
			t.Error("Deleted user should not appear in list")
		}
	}
}

func TestRoutesDeleteUserFounderProtection(t *testing.T) {
	router, db := setupTestRouter(t)

	// Create a founder user
	userService := user.NewService(db)
	founderEntity, err := userService.CreateUserWithRole(db.DB.Statement.Context, "founder@example.com", "password123", "admin", true)
	if err != nil {
		t.Fatalf("Failed to create founder user: %v", err)
	}

	// Try to delete the founder user
	req, _ := http.NewRequest("DELETE", "/api/v1/users/"+founderEntity.UUID.String(), nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Should return Forbidden status
	if w.Code != http.StatusForbidden {
		t.Errorf("Expected status %d (Forbidden), got %d. Body: %s", http.StatusForbidden, w.Code, w.Body.String())
	}

	var response map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if response["error"] != "Founder users cannot be deleted" {
		t.Errorf("Expected 'Founder users cannot be deleted' error, got '%s'", response["error"])
	}

	// Verify founder user still exists
	var count int64
	db.DB.Model(&models.User{}).Where("uuid = ?", founderEntity.UUID).Count(&count)
	if count != 1 {
		t.Error("Founder user should still exist in database after deletion attempt")
	}
}

func TestRoutesDeleteUserRegularUserCanBeDeleted(t *testing.T) {
	router, db := setupTestRouter(t)

	// Create a regular user
	regularUser := createTestUser(t, db, "regular@example.com")

	// Create a founder user
	userService := user.NewService(db)
	_, err := userService.CreateUserWithRole(db.DB.Statement.Context, "founder@example.com", "password123", "admin", true)
	if err != nil {
		t.Fatalf("Failed to create founder user: %v", err)
	}

	// Delete the regular user (should succeed)
	req, _ := http.NewRequest("DELETE", "/api/v1/users/"+regularUser.UUID.String(), nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
	}

	// Verify regular user was deleted
	var regularCount int64
	db.DB.Model(&models.User{}).Where("uuid = ?", regularUser.UUID).Count(&regularCount)
	if regularCount != 0 {
		t.Error("Regular user should have been deleted from database")
	}

	// Verify founder user still exists
	var founderCount int64
	db.DB.Model(&models.User{}).Where("email = ?", "founder@example.com").Count(&founderCount)
	if founderCount != 1 {
		t.Error("Founder user should still exist in database")
	}
}

func TestRequestPasswordResetSuccess(t *testing.T) {
	// Setup test database
	db := database.SetupTestDBWithCache(t, &models.User{}, &models.Session{}, &models.PasswordResetToken{})

	// Create test user
	userService := user.NewService(db)
	userEntity, err := userService.CreateUser(context.Background(), "test@example.com", "password123")
	require.NoError(t, err)
	require.NotNil(t, userEntity)

	// Setup router
	gin.SetMode(gin.TestMode)
	router := gin.New()
	module := NewModule(router.Group("/api/v1"), db)

	// Register routes manually for testing (bypassing middleware)
	usersGroup := router.Group("/api/v1/users")
	usersGroup.POST("/:uuid/password/request_reset", module.requestPasswordReset)

	// Test request
	req := httptest.NewRequest("POST", "/api/v1/users/"+userEntity.UUID.String()+"/password/request_reset", nil)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	// Assertions
	if w.Code != http.StatusCreated {
		t.Logf("Response body: %s", w.Body.String())
	}
	assert.Equal(t, http.StatusCreated, w.Code)

	var response models.PasswordResetTokenResponse
	err = json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)

	assert.Equal(t, "test@example.com", response.Email)
	assert.NotEmpty(t, response.Token)
	assert.True(t, response.ExpiresAt.After(time.Now()))
}

func TestRequestPasswordResetUserNotFound(t *testing.T) {
	// Setup test database
	db := database.SetupTestDBWithCache(t, &models.User{}, &models.Session{}, &models.PasswordResetToken{})

	// Setup router
	gin.SetMode(gin.TestMode)
	router := gin.New()
	module := NewModule(router.Group("/api/v1"), db)

	// Register routes manually for testing (bypassing middleware)
	usersGroup := router.Group("/api/v1/users")
	usersGroup.POST("/:uuid/password/request_reset", module.requestPasswordReset)

	// Test request with non-existent user UUID
	req := httptest.NewRequest("POST", "/api/v1/users/00000000-0000-0000-0000-000000000000/password/request_reset", nil)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	// Assertions
	assert.Equal(t, http.StatusNotFound, w.Code)

	var response map[string]string
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Equal(t, "User not found", response["error"])
}

func TestRequestPasswordResetInvalidUUID(t *testing.T) {
	// Setup test database
	db := database.SetupTestDBWithCache(t, &models.User{}, &models.Session{}, &models.PasswordResetToken{})

	// Setup router
	gin.SetMode(gin.TestMode)
	router := gin.New()
	module := NewModule(router.Group("/api/v1"), db)

	// Register routes manually for testing (bypassing middleware)
	usersGroup := router.Group("/api/v1/users")
	usersGroup.POST("/:uuid/password/request_reset", module.requestPasswordReset)

	// Test request with invalid UUID format
	req := httptest.NewRequest("POST", "/api/v1/users/invalid-uuid/password/request_reset", nil)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	// Assertions
	assert.Equal(t, http.StatusNotFound, w.Code)

	var response map[string]string
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Equal(t, "User not found", response["error"])
}
