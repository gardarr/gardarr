package integration

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jfxdev/gardarr/internal/constants"
	"github.com/jfxdev/gardarr/internal/entities"
	"github.com/jfxdev/gardarr/internal/infra/database"
	"github.com/stretchr/testify/assert"
)

func TestNewService(t *testing.T) {
	ch := make(chan *entities.Event, 10)
	defer close(ch)

	db := database.SetupTestDBWithMigrations(t)
	svc := NewService(ch, db)

	assert.NotNil(t, svc)
	assert.NotNil(t, svc.eventChan)
	assert.NotNil(t, svc.webhookRepo)
	assert.True(t, svc.enabled) // Default should be true
}

func TestServiceStartDisabled(t *testing.T) {
	ch := make(chan *entities.Event, 10)
	defer close(ch)

	db := database.SetupTestDBWithMigrations(t)
	svc := NewService(ch, db)
	svc.enabled = false

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Should not block or panic when disabled
	svc.Start(ctx)

	// Give time for goroutine to start (if any)
	time.Sleep(50 * time.Millisecond)

	// No assertions needed - just ensuring no panic/deadlock
}

func TestServiceStartEnabled(t *testing.T) {
	ch := make(chan *entities.Event, 10)
	db := database.SetupTestDBWithMigrations(t)
	svc := NewService(ch, db)
	svc.enabled = true

	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	svc.Start(ctx)

	// Send a test event
	testEvent := &entities.Event{
		UUID:     uuid.New(),
		WorkerID: uuid.New(),
		Type:     constants.EventTypeTorrentStateChange,
		TaskHash: "test-hash",
		OldValue: "paused",
		NewValue: "downloading",
		Metadata: map[string]interface{}{
			"name":     "Test Task",
			"hash":     "test-hash",
			"state":    "downloading",
			"category": "",
			"size":     0,
		},
		CreatedAt: time.Now(),
	}

	ch <- testEvent

	// Give time for processing
	time.Sleep(50 * time.Millisecond)

	// Wait for context cancellation
	<-ctx.Done()

	// Close channel after context is done
	close(ch)

	// No assertions needed - just ensuring proper handling without panic
}

func TestProcessEventNilEvent(t *testing.T) {
	ch := make(chan *entities.Event, 10)
	defer close(ch)

	db := database.SetupTestDBWithMigrations(t)
	svc := NewService(ch, db)
	svc.enabled = true

	ctx := context.Background()

	// Should not panic with nil event
	assert.NotPanics(t, func() {
		svc.processEvent(ctx, nil)
	})
}

func TestProcessEventValidEvent(t *testing.T) {
	ch := make(chan *entities.Event, 10)
	defer close(ch)

	db := database.SetupTestDBWithMigrations(t)
	svc := NewService(ch, db)
	svc.enabled = true

	ctx := context.Background()

	testEvent := &entities.Event{
		UUID:     uuid.New(),
		WorkerID: uuid.New(),
		Type:     constants.EventTypeTorrentCompleted,
		TaskHash: "valid-hash",
		NewValue: "uploading",
		Metadata: map[string]interface{}{
			"name":     "Valid Task",
			"hash":     "valid-hash",
			"state":    "uploading",
			"category": "",
			"size":     0,
		},
		CreatedAt: time.Now(),
	}

	// Should process without panic
	assert.NotPanics(t, func() {
		svc.processEvent(ctx, testEvent)
	})
}

func TestEnabled(t *testing.T) {
	ch := make(chan *entities.Event, 10)
	defer close(ch)

	db := database.SetupTestDBWithMigrations(t)
	svc := NewService(ch, db)

	// Test default enabled state
	assert.True(t, svc.Enabled())

	// Test disabled state
	svc.enabled = false
	assert.False(t, svc.Enabled())
}

func TestConcurrentReloadAndProcessEvent(t *testing.T) {
	ch := make(chan *entities.Event, 100)

	db := database.SetupTestDBWithMigrations(t)
	svc := NewService(ch, db)
	svc.enabled = true

	ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
	defer cancel()

	// Start the service
	svc.Start(ctx)

	// Simulate concurrent reloads while processing events
	reloadDone := make(chan bool)
	go func() {
		for i := 0; i < 20; i++ {
			svc.ReloadWebhooks(ctx)
			time.Sleep(10 * time.Millisecond)
		}
		reloadDone <- true
	}()

	// Send events concurrently
	sendDone := make(chan bool)
	go func() {
		defer func() { sendDone <- true }()
		for i := 0; i < 50; i++ {
			testEvent := &entities.Event{
				UUID:     uuid.New(),
				WorkerID: uuid.New(),
				Type:     constants.EventTypeTorrentStateChange,
				TaskHash: "test-hash",
				NewValue: "downloading",
				Metadata: map[string]interface{}{
					"name":     "Test Task",
					"category": "test",
					"size":     1024,
				},
				CreatedAt: time.Now(),
			}
			select {
			case ch <- testEvent:
			case <-ctx.Done():
				return
			}
			time.Sleep(5 * time.Millisecond)
		}
	}()

	// Wait for reload goroutine to finish
	<-reloadDone

	// Wait for context to finish
	<-ctx.Done()

	// Wait for sender goroutine to finish before closing channel
	<-sendDone

	// Now safe to close the channel
	close(ch)

	// If we get here without panicking or deadlocking, the test passes
	// This test would fail with -race flag if there's a data race in the service
}
