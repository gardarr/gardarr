package workers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/jfxdev/gardarr/internal/infra/database"
	"github.com/jfxdev/gardarr/internal/middlewares"
	"github.com/jfxdev/gardarr/internal/models"
	"github.com/jfxdev/gardarr/internal/schemas"
	"github.com/jfxdev/gardarr/internal/services/session"
	"github.com/jfxdev/gardarr/internal/services/user"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSetWorkerTaskTags_InvalidJSON(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	router := gin.New()

	// Create module with nil service
	module := &Module{
		service: nil,
	}

	// Register route
	router.PUT("/worker/:id/task/:task_id/tags", module.setWorkerTaskTags)

	// Test request with invalid JSON
	req, _ := http.NewRequest("PUT", "/worker/test-worker-id/task/test-task-id/tags", bytes.NewBufferString("invalid json"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Assertions
	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Contains(t, w.Body.String(), "Invalid request body")
}

func TestSetWorkerSpeedLimitsAcceptsZeroButRequiresBothFields(t *testing.T) {
	gin.SetMode(gin.TestMode)
	module := &Module{}
	tests := []struct {
		name       string
		body       string
		assertCode func(*testing.T, int)
	}{
		{
			name: "zero is a valid unlimited limit",
			body: `{"download_limit":0,"upload_limit":0}`,
			assertCode: func(t *testing.T, code int) {
				assert.NotEqual(t, http.StatusBadRequest, code)
			},
		},
		{
			name: "missing field is rejected",
			body: `{"download_limit":0}`,
			assertCode: func(t *testing.T, code int) {
				assert.Equal(t, http.StatusBadRequest, code)
			},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			router := gin.New()
			router.POST("/worker/:id/speed/limits", module.setWorkerSpeedLimits)
			req := httptest.NewRequest(http.MethodPost, "/worker/worker-id/speed/limits", bytes.NewBufferString(test.body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)
			test.assertCode(t, w.Code)
		})
	}
}

func TestScheduleHandlersRequireBandwidthScheduler(t *testing.T) {
	gin.SetMode(gin.TestMode)
	module := &Module{}
	tests := []struct {
		method  string
		path    string
		handler gin.HandlerFunc
	}{
		{http.MethodGet, "/worker/:id/schedules", module.listSchedules},
		{http.MethodPost, "/worker/:id/schedules", module.createSchedule},
		{http.MethodGet, "/worker/:id/schedules/preview", module.previewSchedule},
		{http.MethodPut, "/worker/:id/schedules/order", module.reorderSchedules},
		{http.MethodGet, "/worker/:id/schedules/:schedule_id", module.getSchedule},
		{http.MethodPut, "/worker/:id/schedules/:schedule_id", module.updateSchedule},
		{http.MethodDelete, "/worker/:id/schedules/:schedule_id", module.deleteSchedule},
	}

	for _, test := range tests {
		t.Run(test.method+" "+test.path, func(t *testing.T) {
			router := gin.New()
			router.Handle(test.method, test.path, test.handler)
			path := strings.ReplaceAll(strings.ReplaceAll(test.path, ":schedule_id", "schedule-id"), ":id", "worker-id")
			request := httptest.NewRequest(test.method, path, nil)
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)
			assert.Equal(t, http.StatusServiceUnavailable, response.Code)
		})
	}
}

func TestSetWorkerTaskTags_ValidJSON(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	router := gin.New()

	// Create module with nil service
	module := &Module{
		service: nil,
	}

	// Register route
	router.PUT("/worker/:id/task/:task_id/tags", module.setWorkerTaskTags)

	// Test data
	requestBody := schemas.TaskSetTagsSchema{
		Tags: []string{"tag1", "tag2"},
	}
	jsonBody, _ := json.Marshal(requestBody)

	// Test request
	req, _ := http.NewRequest("PUT", "/worker/test-worker-id/task/test-task-id/tags", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Assertions - should fail because service is nil, but JSON parsing should work
	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestSetWorkerTaskCategory_InvalidJSON(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	router := gin.New()

	// Create module with nil service
	module := &Module{
		service: nil,
	}

	// Register route
	router.PUT("/worker/:id/task/:task_id/category", module.setWorkerTaskCategory)

	// Test request with invalid JSON
	req, _ := http.NewRequest("PUT", "/worker/test-worker-id/task/test-task-id/category", bytes.NewBufferString("invalid json"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Assertions
	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Contains(t, w.Body.String(), "Invalid request body")
}

func TestSetWorkerTaskCategory_ValidJSON(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	router := gin.New()

	// Create module with nil service
	module := &Module{
		service: nil,
	}

	// Register route
	router.PUT("/worker/:id/task/:task_id/category", module.setWorkerTaskCategory)

	// Test data
	requestBody := schemas.TaskSetCategorySchema{
		Category: "test-category",
	}
	jsonBody, _ := json.Marshal(requestBody)

	// Test request
	req, _ := http.NewRequest("PUT", "/worker/test-worker-id/task/test-task-id/category", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Assertions - should fail because service is nil, but JSON parsing should work
	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

// setupAuthTestRouter builds a router with the real Register() middleware
// chain wired up (session auth + admin gating), backed by an in-memory DB.
func setupAuthTestRouter(t *testing.T) (*gin.Engine, *database.Database) {
	gin.SetMode(gin.TestMode)
	db := database.SetupTestDBWithCache(t, &models.User{}, &models.Session{})

	router := gin.New()
	v1 := router.Group("/v1")
	NewModule(v1, db, nil, nil).Register()

	return router, db
}

// createTestSession creates a user with the given role and an active session,
// returning the session token to use as the session cookie value.
func createTestSession(t *testing.T, db *database.Database, email, role string) string {
	ctx := context.Background()

	entity, err := user.NewService(db).CreateUserWithRole(ctx, email, "password123", role, false)
	require.NoError(t, err)

	sess, err := session.NewService(db).CreateSession(ctx, entity.UUID, entity.Role, "test-agent", "127.0.0.1")
	require.NoError(t, err)

	return sess.Token
}

func TestRegisterRequiresSessionAuth(t *testing.T) {
	router, _ := setupAuthTestRouter(t)

	tests := []struct {
		name   string
		method string
		path   string
	}{
		{"session-only tier", http.MethodGet, "/v1/workers/"},
		{"admin tier", http.MethodPost, "/v1/worker/"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)
			assert.Equal(t, http.StatusUnauthorized, w.Code)
		})
	}
}

func TestCreateWorkerRequiresAdminRole(t *testing.T) {
	router, db := setupAuthTestRouter(t)
	token := createTestSession(t, db, "member@example.com", "user")

	req := httptest.NewRequest(http.MethodPost, "/v1/worker/", bytes.NewBufferString("{}"))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(&http.Cookie{Name: middlewares.SessionCookieName, Value: token})
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusForbidden, w.Code)
}
