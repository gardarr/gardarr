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
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewService(t *testing.T) {
	webhookURL := "https://example.com/webhook"
	svc := NewService(webhookURL, false, 15)

	assert.NotNil(t, svc)
	assert.Equal(t, webhookURL, svc.webhookURL)
	assert.NotNil(t, svc.httpClient)
	assert.True(t, svc.enabled)
	assert.False(t, svc.insecureSkipVerify)
	assert.Equal(t, 15, svc.timeoutSeconds)
}

func TestNewServiceInsecureSkipVerify(t *testing.T) {
	webhookURL := "https://example.com/webhook"
	svc := NewService(webhookURL, true, 30)

	assert.NotNil(t, svc)
	assert.Equal(t, webhookURL, svc.webhookURL)
	assert.NotNil(t, svc.httpClient)
	assert.True(t, svc.enabled)
	assert.True(t, svc.insecureSkipVerify)
	assert.Equal(t, 30, svc.timeoutSeconds)
}

func TestNewServiceDefaultTimeout(t *testing.T) {
	webhookURL := "https://example.com/webhook"
	svc := NewService(webhookURL, false, 0)

	assert.NotNil(t, svc)
	assert.Equal(t, 10, svc.timeoutSeconds) // Should default to 10
}

func TestSendEvent_Success(t *testing.T) {
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

	svc := NewService(server.URL, false, 10)
	ctx := context.Background()

	testEvent := &entities.Event{
		UUID:     uuid.New(),
		AgentID:  uuid.New(),
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
	assert.Equal(t, testEvent.AgentID.String(), receivedPayload.AgentID)
	assert.Equal(t, testEvent.TaskHash, receivedPayload.TaskHash)
	assert.Equal(t, "downloading", receivedPayload.OldValue)
	assert.Equal(t, "seeding", receivedPayload.NewValue)
	assert.NotNil(t, receivedPayload.Metadata)
	assert.Equal(t, "Test Movie", receivedPayload.Metadata["name"])
	assert.Equal(t, "seeding", receivedPayload.Metadata["state"])
	assert.Equal(t, "movies", receivedPayload.Metadata["category"])
}

func TestSendEvent_NilEvent(t *testing.T) {
	svc := NewService("https://example.com/webhook", false, 10)
	ctx := context.Background()

	err := svc.SendEvent(ctx, nil)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "event is nil")
}

func TestSendEvent_Disabled(t *testing.T) {
	svc := NewService("https://example.com/webhook", false, 10)
	svc.SetEnabled(false)
	ctx := context.Background()

	testEvent := &entities.Event{
		UUID:      uuid.New(),
		AgentID:   uuid.New(),
		Type:      constants.EventTypeTorrentStateChange,
		TaskHash:  "test-hash",
		CreatedAt: time.Now(),
	}

	err := svc.SendEvent(ctx, testEvent)
	assert.NoError(t, err) // Should return nil when disabled
}

func TestSendEvent_ServerError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	svc := NewService(server.URL, false, 10)
	ctx := context.Background()

	testEvent := &entities.Event{
		UUID:      uuid.New(),
		AgentID:   uuid.New(),
		Type:      constants.EventTypeTorrentCompleted,
		TaskHash:  "test-hash",
		CreatedAt: time.Now(),
	}

	err := svc.SendEvent(ctx, testEvent)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "webhook returned status 500")
}

func TestSendEvent_WithoutTask(t *testing.T) {
	var receivedPayload Payload
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		require.NoError(t, err)

		err = json.Unmarshal(body, &receivedPayload)
		require.NoError(t, err)

		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	svc := NewService(server.URL, false, 10)
	ctx := context.Background()

	testEvent := &entities.Event{
		UUID:     uuid.New(),
		AgentID:  uuid.New(),
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
	svc := NewService("https://example.com/webhook", false, 10)

	now := time.Now()
	eventID := uuid.New()
	agentID := uuid.New()

	testEvent := &entities.Event{
		UUID:     eventID,
		AgentID:  agentID,
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
	assert.Equal(t, agentID.String(), payload.AgentID)
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
	svc := NewService("https://example.com/webhook", false, 10)

	assert.True(t, svc.Enabled())

	svc.SetEnabled(false)
	assert.False(t, svc.Enabled())

	svc.SetEnabled(true)
	assert.True(t, svc.Enabled())
}
