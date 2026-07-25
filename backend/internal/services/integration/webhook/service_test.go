package webhook

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jfxdev/gardarr/internal/constants"
	"github.com/jfxdev/gardarr/internal/entities"
	"github.com/jfxdev/gardarr/internal/repository/webhook_history"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewService(t *testing.T) {
	webhookURL := "https://example.com/webhook"
	webhookID := uuid.New()
	var historyRepo *webhook_history.Repository = nil
	svc := NewService(webhookID, webhookURL, false, 15, historyRepo)

	assert.NotNil(t, svc)
	assert.Equal(t, webhookURL, svc.webhookURL)
	assert.Equal(t, webhookID, svc.webhookID)
	assert.NotNil(t, svc.httpClient)
	assert.True(t, svc.enabled)
	assert.False(t, svc.insecureSkipVerify)
	assert.Equal(t, 15, svc.timeoutSeconds)
}

func TestNewServiceInsecureSkipVerify(t *testing.T) {
	webhookURL := "https://example.com/webhook"
	webhookID := uuid.New()
	var historyRepo *webhook_history.Repository = nil
	svc := NewService(webhookID, webhookURL, true, 30, historyRepo)

	assert.NotNil(t, svc)
	assert.Equal(t, webhookURL, svc.webhookURL)
	assert.Equal(t, webhookID, svc.webhookID)
	assert.NotNil(t, svc.httpClient)
	assert.True(t, svc.enabled)
	assert.True(t, svc.insecureSkipVerify)
	assert.Equal(t, 30, svc.timeoutSeconds)
}

func TestNewServiceDefaultTimeout(t *testing.T) {
	webhookURL := "https://example.com/webhook"
	webhookID := uuid.New()
	var historyRepo *webhook_history.Repository = nil
	svc := NewService(webhookID, webhookURL, false, 0, historyRepo)

	assert.NotNil(t, svc)
	assert.Equal(t, 10, svc.timeoutSeconds) // Should default to 10
}

func TestSendEventSuccess(t *testing.T) {
	// Create a test HTTP server
	var receivedPayload Payload
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, http.MethodPost, r.Method)
		assert.Equal(t, "application/json", r.Header.Get("Content-Type"))
		assert.Equal(t, "Gardarr-Webhook/1.0", r.Header.Get("User-Agent"))

		body, err := io.ReadAll(r.Body)
		require.NoError(t, err)

		err = json.Unmarshal(body, &receivedPayload)
		require.NoError(t, err)

		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	webhookID := uuid.New()
	svc := NewService(webhookID, server.URL, false, 10, nil)
	ctx := context.Background()

	testEvent := &entities.Event{
		UUID:     uuid.New(),
		WorkerID: uuid.New(),
		Type:     constants.EventTypeTorrentCompleted,
		TaskHash: "test-hash",
		OldValue: "downloading",
		NewValue: "seeding",
		Metadata: map[string]interface{}{
			"name":      "Test Movie",
			"hash":      "test-hash",
			"state":     "seeding",
			"category":  "movies",
			"tags":      []string{"movie", "test"},
			"directory": "/downloads/movies",
			"size":      1024 * 1024 * 1024,
			"progress":  100.0,
			"ratio":     1.5,
			"test_key":  "test_value",
		},
		CreatedAt: time.Now(),
	}

	err := svc.SendEvent(ctx, testEvent)
	assert.NoError(t, err)

	// Verify the received payload
	assert.Equal(t, testEvent.UUID.String(), receivedPayload.EventID)
	assert.Equal(t, testEvent.Type, receivedPayload.EventType)
	assert.Equal(t, testEvent.WorkerID.String(), receivedPayload.WorkerID)
	assert.Equal(t, testEvent.TaskHash, receivedPayload.TaskHash)
	assert.Equal(t, "downloading", receivedPayload.OldValue)
	assert.Equal(t, "seeding", receivedPayload.NewValue)
	assert.NotNil(t, receivedPayload.Metadata)
	assert.Equal(t, "Test Movie", receivedPayload.Metadata["name"])
	assert.Equal(t, "seeding", receivedPayload.Metadata["state"])
	assert.Equal(t, "movies", receivedPayload.Metadata["category"])
}

func TestSendEventNilEvent(t *testing.T) {
	webhookID := uuid.New()
	svc := NewService(webhookID, "https://example.com/webhook", false, 10, nil)
	ctx := context.Background()

	err := svc.SendEvent(ctx, nil)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "event is nil")
}

func TestSendEventDisabled(t *testing.T) {
	webhookID := uuid.New()
	svc := NewService(webhookID, "https://example.com/webhook", false, 10, nil)
	svc.SetEnabled(false)
	ctx := context.Background()

	testEvent := &entities.Event{
		UUID:      uuid.New(),
		WorkerID:  uuid.New(),
		Type:      constants.EventTypeTorrentStateChange,
		TaskHash:  "test-hash",
		CreatedAt: time.Now(),
	}

	err := svc.SendEvent(ctx, testEvent)
	assert.NoError(t, err) // Should return nil when disabled
}

func TestSendEventServerError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	webhookID := uuid.New()
	svc := NewService(webhookID, server.URL, false, 10, nil)
	ctx := context.Background()

	testEvent := &entities.Event{
		UUID:      uuid.New(),
		WorkerID:  uuid.New(),
		Type:      constants.EventTypeTorrentCompleted,
		TaskHash:  "test-hash",
		CreatedAt: time.Now(),
	}

	err := svc.SendEvent(ctx, testEvent)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "webhook returned status 500")
}

func TestSendEventWithoutTask(t *testing.T) {
	var receivedPayload Payload
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		require.NoError(t, err)

		err = json.Unmarshal(body, &receivedPayload)
		require.NoError(t, err)

		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	webhookID := uuid.New()
	svc := NewService(webhookID, server.URL, false, 10, nil)
	ctx := context.Background()

	testEvent := &entities.Event{
		UUID:     uuid.New(),
		WorkerID: uuid.New(),
		Type:     constants.EventTypeTorrentRemoved,
		TaskHash: "removed-hash",
		OldValue: "seeding",
		NewValue: "",
		Metadata: map[string]interface{}{
			"last_progress": 0.75,
		},
		CreatedAt: time.Now(),
	}

	err := svc.SendEvent(ctx, testEvent)
	assert.NoError(t, err)

	// Verify the received payload
	assert.Equal(t, testEvent.UUID.String(), receivedPayload.EventID)
	assert.NotNil(t, receivedPayload.Metadata)
	assert.Equal(t, 0.75, receivedPayload.Metadata["last_progress"])
}

func TestBuildPayload(t *testing.T) {
	webhookID := uuid.New()
	svc := NewService(webhookID, "https://example.com/webhook", false, 10, nil)

	now := time.Now()
	eventID := uuid.New()
	workerID := uuid.New()

	testEvent := &entities.Event{
		UUID:     eventID,
		WorkerID: workerID,
		Type:     constants.EventTypeTorrentCompleted,
		TaskHash: "payload-hash",
		OldValue: "downloading",
		NewValue: "completed",
		Metadata: map[string]interface{}{
			"key":       "value",
			"name":      "Test Task",
			"hash":      "payload-hash",
			"state":     "completed",
			"category":  "tv",
			"tags":      []string{"tv", "series"},
			"directory": "/downloads/tv",
			"size":      2048,
			"progress":  100.0,
			"ratio":     2.0,
		},
		CreatedAt: now,
	}

	payload := svc.buildPayload(testEvent)

	assert.Equal(t, eventID.String(), payload.EventID)
	assert.Equal(t, constants.EventTypeTorrentCompleted, payload.EventType)
	assert.Equal(t, workerID.String(), payload.WorkerID)
	assert.Equal(t, "payload-hash", payload.TaskHash)
	assert.Equal(t, "downloading", payload.OldValue)
	assert.Equal(t, "completed", payload.NewValue)
	assert.Equal(t, now.Format(time.RFC3339), payload.Timestamp)
	assert.NotNil(t, payload.Metadata)
	assert.Equal(t, "value", payload.Metadata["key"])
	assert.Equal(t, "Test Task", payload.Metadata["name"])
	assert.Equal(t, "payload-hash", payload.Metadata["hash"])
	assert.Equal(t, "completed", payload.Metadata["state"])
	assert.Equal(t, "tv", payload.Metadata["category"])
	assert.Equal(t, 2048, payload.Metadata["size"])
	assert.Equal(t, 100.0, payload.Metadata["progress"])
	assert.Equal(t, 2.0, payload.Metadata["ratio"])
}

func TestEnabled(t *testing.T) {
	webhookID := uuid.New()
	svc := NewService(webhookID, "https://example.com/webhook", false, 10, nil)

	assert.True(t, svc.Enabled())

	svc.SetEnabled(false)
	assert.False(t, svc.Enabled())

	svc.SetEnabled(true)
	assert.True(t, svc.Enabled())
}

func retryTestEvent() *entities.Event {
	return &entities.Event{
		UUID:      uuid.New(),
		WorkerID:  uuid.New(),
		Type:      constants.EventTypeTorrentCompleted,
		TaskHash:  "retry-hash",
		NewValue:  "seeding",
		CreatedAt: time.Now(),
	}
}

func TestSendEventWithRetrySucceedsAfterTransientFailures(t *testing.T) {
	var attempts int
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempts++
		if attempts < 3 {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	svc := NewService(uuid.New(), server.URL, false, 10, nil)
	svc.maxAttempts = 3
	svc.baseBackoff = time.Millisecond

	err := svc.SendEventWithRetry(context.Background(), retryTestEvent())
	assert.NoError(t, err)
	assert.Equal(t, 3, attempts)
}

func TestSendEventWithRetryDoesNotRetryClientErrors(t *testing.T) {
	var attempts int
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempts++
		w.WriteHeader(http.StatusBadRequest)
	}))
	defer server.Close()

	svc := NewService(uuid.New(), server.URL, false, 10, nil)
	svc.maxAttempts = 3
	svc.baseBackoff = time.Millisecond

	err := svc.SendEventWithRetry(context.Background(), retryTestEvent())
	assert.Error(t, err)
	assert.Equal(t, 1, attempts)
}

func TestSendEventWithRetryRetriesTooManyRequests(t *testing.T) {
	var attempts int
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempts++
		w.WriteHeader(http.StatusTooManyRequests)
	}))
	defer server.Close()

	svc := NewService(uuid.New(), server.URL, false, 10, nil)
	svc.maxAttempts = 2
	svc.baseBackoff = time.Millisecond

	err := svc.SendEventWithRetry(context.Background(), retryTestEvent())
	assert.Error(t, err)
	assert.Equal(t, 2, attempts)
}

func TestSendEventWithRetryRespectsContextCancellation(t *testing.T) {
	var attempts int
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempts++
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	svc := NewService(uuid.New(), server.URL, false, 10, nil)
	svc.maxAttempts = 5
	svc.baseBackoff = time.Hour // would block forever if cancellation were ignored

	ctx, cancel := context.WithCancel(context.Background())
	go func() {
		time.Sleep(50 * time.Millisecond)
		cancel()
	}()

	err := svc.SendEventWithRetry(ctx, retryTestEvent())
	assert.ErrorIs(t, err, context.Canceled)
	assert.Equal(t, 1, attempts)
}
