package tags

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

// setupTestRouter creates a test router with the tags routes, registered
// without session middleware (matching the category routes_test.go
// pattern) and a nil workermanager, so tag creation persists locally only.
func setupTestRouter(t *testing.T) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	db := database.SetupTestDBWithCache(t, &models.Tag{}, &models.User{}, &models.Session{})

	v1 := router.Group("/api/v1")
	module := NewModule(v1, db, nil)
	tagsGroup := v1.Group("/tags")

	tagsGroup.POST("", module.createTag)
	tagsGroup.GET("", module.listTags)
	tagsGroup.PUT("/:id", module.updateTag)
	tagsGroup.DELETE("", module.deleteTag)
	tagsGroup.POST("/rename", module.renameTag)
	tagsGroup.POST("/merge", module.mergeTags)

	return router
}

func sendJSONRequest(router *gin.Engine, method, url string, body interface{}) *httptest.ResponseRecorder {
	var reqBody []byte
	if body != nil {
		reqBody, _ = json.Marshal(body)
	}
	req, _ := http.NewRequest(method, url, bytes.NewBuffer(reqBody))
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	return w
}

func TestRoutes_CreateTag_Success(t *testing.T) {
	router := setupTestRouter(t)

	body := map[string]interface{}{
		"name":  "movies",
		"color": "#FF5733",
		"icon":  "film-icon",
	}

	w := sendJSONRequest(router, "POST", "/api/v1/tags", body)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected status %d, got %d: %s", http.StatusCreated, w.Code, w.Body.String())
	}

	var response models.TagResponse
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}

	if response.Name != "movies" {
		t.Errorf("expected name 'movies', got '%s'", response.Name)
	}
	if response.Kind != models.TagKindTag {
		t.Errorf("expected kind to default to 'tag', got '%s'", response.Kind)
	}
	if response.ID == "" {
		t.Error("expected ID to be generated")
	}
	if response.Color != "#FF5733" {
		t.Errorf("expected color '#FF5733', got '%s'", response.Color)
	}
}

func TestRoutes_CreateTag_ExplicitScopeKind(t *testing.T) {
	router := setupTestRouter(t)

	body := map[string]interface{}{"name": "quality", "kind": "scope"}
	w := sendJSONRequest(router, "POST", "/api/v1/tags", body)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected status %d, got %d: %s", http.StatusCreated, w.Code, w.Body.String())
	}

	var response models.TagResponse
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}
	if response.Kind != models.TagKindScope {
		t.Errorf("expected kind 'scope', got '%s'", response.Kind)
	}
}

func TestRoutes_CreateTag_InvalidBody(t *testing.T) {
	router := setupTestRouter(t)

	w := sendJSONRequest(router, "POST", "/api/v1/tags", map[string]interface{}{})

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status %d, got %d", http.StatusBadRequest, w.Code)
	}
}

func TestRoutes_CreateTag_Duplicate(t *testing.T) {
	router := setupTestRouter(t)

	body := map[string]interface{}{"name": "movies"}
	sendJSONRequest(router, "POST", "/api/v1/tags", body)
	w := sendJSONRequest(router, "POST", "/api/v1/tags", body)

	if w.Code != http.StatusConflict {
		t.Errorf("expected status %d, got %d", http.StatusConflict, w.Code)
	}
}

func TestRoutes_ListTags_Empty(t *testing.T) {
	router := setupTestRouter(t)

	w := sendJSONRequest(router, "GET", "/api/v1/tags", nil)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, w.Code)
	}

	var response []models.TagResponse
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}
	if len(response) != 0 {
		t.Errorf("expected empty list, got %d", len(response))
	}
}

func TestRoutes_ListTags_ReturnsStored(t *testing.T) {
	router := setupTestRouter(t)

	sendJSONRequest(router, "POST", "/api/v1/tags", map[string]interface{}{"name": "movies"})
	sendJSONRequest(router, "POST", "/api/v1/tags", map[string]interface{}{"name": "music"})

	w := sendJSONRequest(router, "GET", "/api/v1/tags", nil)

	var response []models.TagResponse
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}
	if len(response) != 2 {
		t.Errorf("expected 2 tags, got %d", len(response))
	}
}

func TestRoutes_UpdateTag_Success(t *testing.T) {
	router := setupTestRouter(t)

	createResp := sendJSONRequest(router, "POST", "/api/v1/tags", map[string]interface{}{
		"name":  "movies",
		"color": "#FF5733",
	})
	var created models.TagResponse
	if err := json.Unmarshal(createResp.Body.Bytes(), &created); err != nil {
		t.Fatalf("failed to unmarshal create response: %v", err)
	}

	w := sendJSONRequest(router, "PUT", "/api/v1/tags/"+created.ID, map[string]interface{}{
		"color": "#000000",
		"icon":  "new-icon",
	})

	if w.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d: %s", http.StatusOK, w.Code, w.Body.String())
	}

	var response models.TagResponse
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}
	if response.Color != "#000000" {
		t.Errorf("expected color '#000000', got '%s'", response.Color)
	}
	if response.Name != "movies" {
		t.Errorf("expected name to stay 'movies', got '%s'", response.Name)
	}
}

func TestRoutes_UpdateTag_NotFound(t *testing.T) {
	router := setupTestRouter(t)

	w := sendJSONRequest(router, "PUT", "/api/v1/tags/nonexistent", map[string]interface{}{"color": "#000000"})

	if w.Code != http.StatusNotFound {
		t.Errorf("expected status %d, got %d", http.StatusNotFound, w.Code)
	}
}

func TestRoutes_DeleteTag_RequiresName(t *testing.T) {
	router := setupTestRouter(t)

	w := sendJSONRequest(router, "DELETE", "/api/v1/tags", nil)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status %d, got %d", http.StatusBadRequest, w.Code)
	}
}

func TestRoutes_DeleteTag_RejectsInvalidKind(t *testing.T) {
	router := setupTestRouter(t)

	w := sendJSONRequest(router, "DELETE", "/api/v1/tags?name=movies&kind=bogus", nil)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status %d, got %d", http.StatusBadRequest, w.Code)
	}
}

func TestRoutes_DeleteTag_Success(t *testing.T) {
	router := setupTestRouter(t)

	sendJSONRequest(router, "POST", "/api/v1/tags", map[string]interface{}{"name": "movies"})

	w := sendJSONRequest(router, "DELETE", "/api/v1/tags?name=movies", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d: %s", http.StatusOK, w.Code, w.Body.String())
	}

	listResp := sendJSONRequest(router, "GET", "/api/v1/tags", nil)
	var list []models.TagResponse
	if err := json.Unmarshal(listResp.Body.Bytes(), &list); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}
	if len(list) != 0 {
		t.Errorf("expected tag to be deleted, got %d remaining", len(list))
	}
}

func TestRoutes_RenameTag_InvalidBody(t *testing.T) {
	router := setupTestRouter(t)

	w := sendJSONRequest(router, "POST", "/api/v1/tags/rename", map[string]interface{}{"from": "movies"})

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status %d, got %d", http.StatusBadRequest, w.Code)
	}
}

func TestRoutes_RenameTag_SameNameRejected(t *testing.T) {
	router := setupTestRouter(t)

	w := sendJSONRequest(router, "POST", "/api/v1/tags/rename", map[string]interface{}{"from": "movies", "to": "movies"})

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status %d, got %d", http.StatusBadRequest, w.Code)
	}
}

func TestRoutes_RenameTag_Success(t *testing.T) {
	router := setupTestRouter(t)

	sendJSONRequest(router, "POST", "/api/v1/tags", map[string]interface{}{"name": "movies", "color": "#FF5733"})

	w := sendJSONRequest(router, "POST", "/api/v1/tags/rename", map[string]interface{}{"from": "movies", "to": "films"})
	if w.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d: %s", http.StatusOK, w.Code, w.Body.String())
	}

	listResp := sendJSONRequest(router, "GET", "/api/v1/tags", nil)
	var list []models.TagResponse
	if err := json.Unmarshal(listResp.Body.Bytes(), &list); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}
	if len(list) != 0 {
		t.Errorf("expected source row to be dropped, got %d remaining", len(list))
	}
}

func TestRoutes_MergeTags_TargetInSourcesRejected(t *testing.T) {
	router := setupTestRouter(t)

	w := sendJSONRequest(router, "POST", "/api/v1/tags/merge", map[string]interface{}{
		"sources": []string{"movies", "films"},
		"target":  "movies",
	})

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status %d, got %d", http.StatusBadRequest, w.Code)
	}
}

func TestRoutes_MergeTags_Success(t *testing.T) {
	router := setupTestRouter(t)

	sendJSONRequest(router, "POST", "/api/v1/tags", map[string]interface{}{"name": "movies"})
	sendJSONRequest(router, "POST", "/api/v1/tags", map[string]interface{}{"name": "films"})
	sendJSONRequest(router, "POST", "/api/v1/tags", map[string]interface{}{"name": "cinema"})

	w := sendJSONRequest(router, "POST", "/api/v1/tags/merge", map[string]interface{}{
		"sources": []string{"movies", "films"},
		"target":  "cinema",
	})
	if w.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d: %s", http.StatusOK, w.Code, w.Body.String())
	}

	listResp := sendJSONRequest(router, "GET", "/api/v1/tags", nil)
	var list []models.TagResponse
	if err := json.Unmarshal(listResp.Body.Bytes(), &list); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}
	if len(list) != 1 || list[0].Name != "cinema" {
		t.Errorf("expected only 'cinema' to remain, got %v", list)
	}
}
