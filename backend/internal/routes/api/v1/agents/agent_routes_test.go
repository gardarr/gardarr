package agents

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gardarr/gardarr/internal/services/agentmanager"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestGetAgentVersion_StandaloneMode(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	router := gin.New()

	// Create a mock service
	mockService := &agentmanager.Service{}

	// Create module
	module := &Module{
		service: mockService,
	}

	// Register route
	router.GET("/agent/:id/version", module.getAgentVersion)

	// Test standalone mode
	req, _ := http.NewRequest("GET", "/agent/00000000-0000-0000-0000-000000000000/version?mode=standalone", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Assertions
	assert.Equal(t, http.StatusOK, w.Code)

	// The response should contain the version information
	assert.Contains(t, w.Body.String(), `"version"`)
	assert.Contains(t, w.Body.String(), `"commit"`)
	assert.Contains(t, w.Body.String(), `"date"`)
}
