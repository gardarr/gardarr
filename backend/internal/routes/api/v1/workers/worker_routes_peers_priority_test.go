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

func TestSetWorkerTaskQueuePriority_InvalidJSON(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	module := &Module{service: nil}
	router.PUT("/worker/:id/task/:task_id/priority", module.setWorkerTaskQueuePriority)

	req, _ := http.NewRequest("PUT", "/worker/test-worker-id/task/test-task-id/priority", bytes.NewBufferString("invalid json"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Contains(t, w.Body.String(), "Invalid request body")
}

func TestSetWorkerTaskQueuePriority_InvalidAction(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	module := &Module{service: nil}
	router.PUT("/worker/:id/task/:task_id/priority", module.setWorkerTaskQueuePriority)

	body, _ := json.Marshal(schemas.TaskSetQueuePrioritySchema{Action: "sideways"})
	req, _ := http.NewRequest("PUT", "/worker/test-worker-id/task/test-task-id/priority", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestSetWorkerTaskQueuePriority_ValidJSON(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	// Nil service is safe here: workerID "test-worker-id" fails uuid.Parse
	// inside fetchWorker before the nil *Service is ever dereferenced.
	module := &Module{service: nil}
	router.PUT("/worker/:id/task/:task_id/priority", module.setWorkerTaskQueuePriority)

	body, _ := json.Marshal(schemas.TaskSetQueuePrioritySchema{Action: "top"})
	req, _ := http.NewRequest("PUT", "/worker/test-worker-id/task/test-task-id/priority", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestListWorkerTaskPeers_ServiceError(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	module := &Module{service: nil}
	router.GET("/worker/:id/task/:task_id/peers", module.listWorkerTaskPeers)

	req, _ := http.NewRequest("GET", "/worker/test-worker-id/task/test-task-id/peers", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestBanWorkerPeer_InvalidJSON(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	module := &Module{service: nil}
	router.POST("/worker/:id/peers/ban", module.banWorkerPeer)

	req, _ := http.NewRequest("POST", "/worker/test-worker-id/peers/ban", bytes.NewBufferString("invalid json"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Contains(t, w.Body.String(), "Invalid request body")
}

func TestBanWorkerPeer_InvalidIP(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	module := &Module{service: nil}
	router.POST("/worker/:id/peers/ban", module.banWorkerPeer)

	body, _ := json.Marshal(schemas.WorkerBanPeerSchema{IP: "not-an-ip", Port: 51413})
	req, _ := http.NewRequest("POST", "/worker/test-worker-id/peers/ban", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestBanWorkerPeer_ValidJSON(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	module := &Module{service: nil}
	router.POST("/worker/:id/peers/ban", module.banWorkerPeer)

	body, _ := json.Marshal(schemas.WorkerBanPeerSchema{IP: "203.0.113.5", Port: 51413})
	req, _ := http.NewRequest("POST", "/worker/test-worker-id/peers/ban", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
}
