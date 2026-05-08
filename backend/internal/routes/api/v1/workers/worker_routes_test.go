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

func TestGetWorkerVersion_StandaloneMode(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	router := gin.New()

	// Create module with nil service for standalone test
	module := &Module{
		service: nil,
	}

	// Register route
	router.GET("/worker/:id/version", module.getWorkerVersion)

	// Test standalone mode
	req, _ := http.NewRequest("GET", "/worker/00000000-0000-0000-0000-000000000000/version?mode=standalone", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Assertions
	assert.Equal(t, http.StatusOK, w.Code)

	// The response should contain the version information
	assert.Contains(t, w.Body.String(), `"version"`)
	assert.Contains(t, w.Body.String(), `"commit"`)
	assert.Contains(t, w.Body.String(), `"date"`)
}

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
