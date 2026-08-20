package workers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/jfxdev/gardarr/internal/schemas"
	"github.com/stretchr/testify/assert"
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

	t.Run("zero is a valid unlimited limit", func(t *testing.T) {
		router := gin.New()
		router.POST("/worker/:id/speed/limits", module.setWorkerSpeedLimits)
		req := httptest.NewRequest(http.MethodPost, "/worker/worker/speed/limits", bytes.NewBufferString(`{"download_limit":0,"upload_limit":0}`))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		// Binding passed; the nil service makes the handler fail later.
		assert.Equal(t, http.StatusInternalServerError, w.Code)
	})

	t.Run("missing field is rejected", func(t *testing.T) {
		router := gin.New()
		router.POST("/worker/:id/speed/limits", module.setWorkerSpeedLimits)
		req := httptest.NewRequest(http.MethodPost, "/worker/worker/speed/limits", bytes.NewBufferString(`{"download_limit":0}`))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})
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
