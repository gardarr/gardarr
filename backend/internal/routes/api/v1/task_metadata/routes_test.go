package task_metadata

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/jfxdev/gardarr/internal/infra/database"
	"github.com/jfxdev/gardarr/internal/models"
	taskmetadatasvc "github.com/jfxdev/gardarr/internal/services/task_metadata"
)

type routeMockProvider struct {
	selection  *taskmetadatasvc.MetadataProviderSelection
	resolveErr error
}

func (m routeMockProvider) Name() string {
	return "tgdb"
}

func (m routeMockProvider) Status(_ context.Context) (*taskmetadatasvc.MetadataProviderStatus, error) {
	return &taskmetadatasvc.MetadataProviderStatus{Provider: "tgdb", Active: true}, nil
}

func (m routeMockProvider) Search(_ context.Context, _ string) ([]taskmetadatasvc.MetadataProviderSearchResult, error) {
	return nil, nil
}

func (m routeMockProvider) Resolve(_ context.Context, _ string) (*taskmetadatasvc.MetadataProviderSelection, error) {
	if m.resolveErr != nil {
		return nil, m.resolveErr
	}
	return m.selection, nil
}

func (m routeMockProvider) BuildImageURL(imageID string) (string, error) {
	return "https://cdn.thegamesdb.net/images/large/" + imageID, nil
}

func (m routeMockProvider) AllowedImageHosts() []string {
	return []string{"cdn.thegamesdb.net"}
}

func setupTaskMetadataApplyRouter(t *testing.T, provider taskmetadatasvc.MetadataProvider) *gin.Engine {
	t.Helper()

	gin.SetMode(gin.TestMode)
	router := gin.New()
	db := database.SetupTestDB(t, &models.TaskMetadata{})
	registry := taskmetadatasvc.NewMetadataProviderRegistry(provider)
	service, err := taskmetadatasvc.NewService(db, "http://localhost:3200", t.TempDir(), registry)
	if err != nil {
		t.Fatalf("NewService failed: %v", err)
	}

	module := NewModule(router.Group("/api/v1"), db, service)
	router.POST("/api/v1/tasks/metadata/:task_hash/providers/:provider", module.applyProvider)

	return router
}

func sendTaskMetadataJSONRequest(t *testing.T, router *gin.Engine, method, url string, body interface{}) *httptest.ResponseRecorder {
	t.Helper()

	payload, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("failed to marshal request body: %v", err)
	}

	req, err := http.NewRequest(method, url, bytes.NewBuffer(payload))
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	return w
}

func TestApplyProviderRouteSuccess(t *testing.T) {
	router := setupTaskMetadataApplyRouter(t, routeMockProvider{
		selection: &taskmetadatasvc.MetadataProviderSelection{
			ID:          "123",
			Title:       "Test Game",
			ReleaseDate: "2024-01-01",
			Description: "Overview",
		},
	})

	w := sendTaskMetadataJSONRequest(t, router, http.MethodPost, "/api/v1/tasks/metadata/task-123/providers/tgdb", map[string]string{
		"id": "123",
	})

	if w.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d: %s", http.StatusOK, w.Code, w.Body.String())
	}

	var response models.TaskMetadataResponse
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}

	if response.TaskHash != "task-123" || response.Name != "Test Game" {
		t.Fatalf("unexpected response: %#v", response)
	}
}

func TestApplyProviderRouteRequiresID(t *testing.T) {
	router := setupTaskMetadataApplyRouter(t, routeMockProvider{})

	w := sendTaskMetadataJSONRequest(t, router, http.MethodPost, "/api/v1/tasks/metadata/task-123/providers/tgdb", map[string]string{})

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, w.Code)
	}
}

func TestApplyProviderRouteReturnsNotFoundForUnknownProvider(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	db := database.SetupTestDB(t, &models.TaskMetadata{})
	service, err := taskmetadatasvc.NewService(db, "http://localhost:3200", t.TempDir(), taskmetadatasvc.NewMetadataProviderRegistry())
	if err != nil {
		t.Fatalf("NewService failed: %v", err)
	}

	module := NewModule(router.Group("/api/v1"), db, service)
	router.POST("/api/v1/tasks/metadata/:task_hash/providers/:provider", module.applyProvider)

	w := sendTaskMetadataJSONRequest(t, router, http.MethodPost, "/api/v1/tasks/metadata/task-123/providers/tgdb", map[string]string{
		"id": "123",
	})

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected status %d, got %d", http.StatusNotFound, w.Code)
	}
}

func TestApplyProviderRouteReturnsNotFoundForUnknownSelection(t *testing.T) {
	router := setupTaskMetadataApplyRouter(t, routeMockProvider{
		resolveErr: taskmetadatasvc.ErrProviderSelectionNotFound,
	})

	w := sendTaskMetadataJSONRequest(t, router, http.MethodPost, "/api/v1/tasks/metadata/task-123/providers/tgdb", map[string]string{
		"id": "404",
	})

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected status %d, got %d", http.StatusNotFound, w.Code)
	}
}

func TestApplyProviderRouteFallsBackToProvidedSelectionOnResolveError(t *testing.T) {
	router := setupTaskMetadataApplyRouter(t, routeMockProvider{
		resolveErr: fmt.Errorf("unexpected status code: 404"),
	})

	w := sendTaskMetadataJSONRequest(t, router, http.MethodPost, "/api/v1/tasks/metadata/task-123/providers/tgdb", map[string]string{
		"id":           "123",
		"title":        "Fallback Game",
		"release_date": "2024-01-01",
		"description":  "Overview",
	})

	if w.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d: %s", http.StatusOK, w.Code, w.Body.String())
	}

	var response models.TaskMetadataResponse
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}

	if response.TaskHash != "task-123" || response.Name != "Fallback Game" {
		t.Fatalf("unexpected response: %#v", response)
	}
	if response.Warning == "" || response.WarningReason == "" {
		t.Fatalf("expected warning fields to be set, got %#v", response)
	}
}

func TestApplyProviderRouteIgnoresLegacyImageURLField(t *testing.T) {
	router := setupTaskMetadataApplyRouter(t, routeMockProvider{
		resolveErr: fmt.Errorf("unexpected status code: 404"),
	})

	w := sendTaskMetadataJSONRequest(t, router, http.MethodPost, "/api/v1/tasks/metadata/task-123/providers/tgdb", map[string]string{
		"id":           "123",
		"title":        "Fallback Game",
		"release_date": "2024-01-01",
		"description":  "Overview",
		"image_url":    "https://cdn.thegamesdb.net/images/large/front.jpg",
	})

	if w.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d: %s", http.StatusOK, w.Code, w.Body.String())
	}

	var response models.TaskMetadataResponse
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}

	if response.ImageURL != "" {
		t.Fatalf("expected legacy image_url payload to be ignored, got image_url=%q", response.ImageURL)
	}
	if response.Name != "Fallback Game" {
		t.Fatalf("expected fallback metadata to be applied, got %#v", response)
	}
}
