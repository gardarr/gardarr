package middlewares

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jfxdev/gardarr/internal/entities"
)

func TestRequireAdminRole(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name          string
		session       *entities.Session
		expectStatus  int
		expectError   string
		expectMessage string
	}{
		{
			name: "Admin user should pass",
			session: &entities.Session{
				ID:        uuid.New(),
				UserUUID:  uuid.New(),
				Token:     "test-token",
				Role:      "admin",
				UserAgent: "test-agent",
				IPAddress: "127.0.0.1",
				ExpiresAt: time.Now().Add(24 * time.Hour),
				CreatedAt: time.Now(),
			},
			expectStatus: http.StatusOK,
		},
		{
			name: "Regular user should be forbidden",
			session: &entities.Session{
				ID:        uuid.New(),
				UserUUID:  uuid.New(),
				Token:     "test-token",
				Role:      "user",
				UserAgent: "test-agent",
				IPAddress: "127.0.0.1",
				ExpiresAt: time.Now().Add(24 * time.Hour),
				CreatedAt: time.Now(),
			},
			expectStatus:  http.StatusForbidden,
			expectError:   "Admin privileges required",
			expectMessage: "This action requires administrator privileges",
		},
		{
			name: "Empty role should be forbidden",
			session: &entities.Session{
				ID:        uuid.New(),
				UserUUID:  uuid.New(),
				Token:     "test-token",
				Role:      "",
				UserAgent: "test-agent",
				IPAddress: "127.0.0.1",
				ExpiresAt: time.Now().Add(24 * time.Hour),
				CreatedAt: time.Now(),
			},
			expectStatus:  http.StatusForbidden,
			expectError:   "Admin privileges required",
			expectMessage: "This action requires administrator privileges",
		},
		{
			name: "Invalid role should be forbidden",
			session: &entities.Session{
				ID:        uuid.New(),
				UserUUID:  uuid.New(),
				Token:     "test-token",
				Role:      "superuser",
				UserAgent: "test-agent",
				IPAddress: "127.0.0.1",
				ExpiresAt: time.Now().Add(24 * time.Hour),
				CreatedAt: time.Now(),
			},
			expectStatus:  http.StatusForbidden,
			expectError:   "Admin privileges required",
			expectMessage: "This action requires administrator privileges",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a test router
			router := gin.New()

			// Set session in context (simulating SessionMiddleware) - must be before RequireAdminRole
			router.Use(func(c *gin.Context) {
				if tt.session != nil {
					c.Set(SessionContextKey, tt.session)
				}
				c.Next()
			})

			// Add a test route that requires admin role
			router.GET("/admin-only", RequireAdminRole(), func(c *gin.Context) {
				c.JSON(http.StatusOK, gin.H{"message": "Access granted"})
			})

			// Create a test request
			req, _ := http.NewRequest("GET", "/admin-only", nil)
			w := httptest.NewRecorder()

			// Perform the request
			router.ServeHTTP(w, req)

			// Check status code
			if w.Code != tt.expectStatus {
				t.Errorf("Expected status %d, got %d", tt.expectStatus, w.Code)
			}

			// Check response body for error cases
			if tt.expectError != "" {
				var response map[string]string
				if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
					t.Fatalf("Failed to unmarshal response: %v", err)
				}

				if response["error"] != tt.expectError {
					t.Errorf("Expected error '%s', got '%s'", tt.expectError, response["error"])
				}

				if tt.expectMessage != "" && response["message"] != tt.expectMessage {
					t.Errorf("Expected message '%s', got '%s'", tt.expectMessage, response["message"])
				}
			}
		})
	}
}

func TestRequireAdminRole_NoUserInContext(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Create a test router
	router := gin.New()

	// Add a test route that requires admin role
	router.GET("/admin-only", RequireAdminRole(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "Access granted"})
	})

	// Create a test request
	req, _ := http.NewRequest("GET", "/admin-only", nil)
	w := httptest.NewRecorder()

	// Perform the request without setting user in context
	router.ServeHTTP(w, req)

	// Should return 401 Unauthorized
	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected status %d, got %d", http.StatusUnauthorized, w.Code)
	}

	// Check response body
	var response map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if response["error"] != "Authentication required" {
		t.Errorf("Expected error 'Authentication required', got '%s'", response["error"])
	}
}

func TestRequireAdminRole_InvalidSessionType(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Create a test router
	router := gin.New()

	// Set invalid session type in context - must be before RequireAdminRole
	router.Use(func(c *gin.Context) {
		c.Set(SessionContextKey, "invalid-session-type")
		c.Next()
	})

	// Add a test route that requires admin role
	router.GET("/admin-only", RequireAdminRole(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "Access granted"})
	})

	// Create a test request
	req, _ := http.NewRequest("GET", "/admin-only", nil)
	w := httptest.NewRecorder()

	// Perform the request
	router.ServeHTTP(w, req)

	// Should return 500 Internal Server Error
	if w.Code != http.StatusInternalServerError {
		t.Errorf("Expected status %d, got %d", http.StatusInternalServerError, w.Code)
	}

	// Check response body
	var response map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if response["error"] != "Invalid session data" {
		t.Errorf("Expected error 'Invalid session data', got '%s'", response["error"])
	}
}

func TestRequireAdminRole_IntegrationWithSessionMiddleware(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// This test demonstrates how the middleware should be used in practice
	// Note: This is a simplified test without actual database/session validation

	// Create a test router
	router := gin.New()

	// Simulate SessionMiddleware setting session in context
	router.Use(func(c *gin.Context) {
		// Simulate admin session
		adminSession := &entities.Session{
			ID:        uuid.New(),
			UserUUID:  uuid.New(),
			Token:     "test-token",
			Role:      "admin",
			UserAgent: "test-agent",
			IPAddress: "127.0.0.1",
			ExpiresAt: time.Now().Add(24 * time.Hour),
			CreatedAt: time.Now(),
		}
		c.Set(SessionContextKey, adminSession)
		c.Next()
	})

	// Add a test route that requires admin role
	router.GET("/admin-only", RequireAdminRole(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "Admin access granted"})
	})

	// Create a test request
	req, _ := http.NewRequest("GET", "/admin-only", nil)
	w := httptest.NewRecorder()

	// Perform the request
	router.ServeHTTP(w, req)

	// Should return 200 OK
	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}

	// Check response body
	var response map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if response["message"] != "Admin access granted" {
		t.Errorf("Expected message 'Admin access granted', got '%s'", response["message"])
	}
}
