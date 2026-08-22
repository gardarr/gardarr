package websocket

import (
	"context"
	"log/slog"
	"sync"
	"sync/atomic"
	"time"

	"github.com/google/uuid"
	"github.com/jfxdev/gardarr/internal/constants"
	"github.com/jfxdev/gardarr/internal/entities"
	"github.com/jfxdev/gardarr/internal/mappers"
	"github.com/jfxdev/gardarr/internal/models"
	"github.com/jfxdev/gardarr/internal/services/events"
	"github.com/jfxdev/gardarr/internal/services/workermanager"
	"github.com/jfxdev/gardarr/pkg/env"
)

// wsEventTypeFor translates an internal entities.Event.Type (dotted, lowercase)
// into the WebSocket wire protocol's event_type vocabulary (uppercase, underscored),
// which the frontend switches on.
func wsEventTypeFor(eventType string) string {
	switch eventType {
	case constants.EventTypeTorrentAdded:
		return "TORRENT_ADDED"
	case constants.EventTypeTorrentStateChange:
		return "TORRENT_STATE_CHANGE"
	case constants.EventTypeTorrentRemoved:
		return "TORRENT_REMOVED"
	case constants.EventTypeTorrentCompleted:
		return "TORRENT_COMPLETED"
	case constants.EventTypeWorkerOffline, constants.EventTypeWorkerRecovered:
		return "WORKER_STATUS_CHANGED"
	default:
		return eventType
	}
}

// eventPayload builds the WS payload for an internal event. Worker status
// transitions (worker.offline/worker.recovered) expose status/error/
// error_code/permanent at the top level, matching sendHealthSnapshot's
// shape, so the frontend can handle both the same way. Other event types
// keep the generic hash/old_value/new_value/metadata shape.
func eventPayload(e *entities.Event) map[string]interface{} {
	if e.Type == constants.EventTypeWorkerOffline || e.Type == constants.EventTypeWorkerRecovered {
		return map[string]interface{}{
			"status":     e.Metadata["status"],
			"error":      e.Metadata["error"],
			"error_code": e.Metadata["error_code"],
			"permanent":  e.Metadata["permanent"],
		}
	}
	return map[string]interface{}{
		"hash":      e.TaskHash,
		"old_value": e.OldValue,
		"new_value": e.NewValue,
		"metadata":  e.Metadata,
	}
}

// WSEvent defines the structure of events sent to the client
type WSEvent struct {
	EventType string            `json:"event_type"`
	WorkerID  string            `json:"worker_id,omitempty"`
	Payload   interface{}       `json:"payload"`
	Errors    map[string]string `json:"errors,omitempty"`
}

// Client represents a connected WebSocket client
type Client struct {
	ID        uuid.UUID
	SessionID string // To map to auth session for logout termination
	Send      chan *WSEvent
	Hub       *Hub
	closeOnce sync.Once
}

// closeSend closes the client's send channel exactly once, safe to call
// concurrently from readPump/writePump and from the hub's shutdown path.
// Returns true if this call performed the close (i.e. was first).
func (c *Client) closeSend() bool {
	closed := false
	c.closeOnce.Do(func() {
		close(c.Send)
		closed = true
	})
	return closed
}

// Close safely closes the client's send channel and deregisters it.
// If the send channel was already closed elsewhere (e.g. hub shutdown),
// this is a no-op: the caller that closed it is responsible for cleanup.
func (c *Client) Close() {
	if c.closeSend() {
		c.Hub.Unregister <- c
	}
}

// Hub maintains the set of active clients and broadcasts messages to them
type Hub struct {
	clients    map[*Client]bool
	Broadcast  chan *WSEvent
	Register   chan *Client
	Unregister chan *Client
	mu         sync.RWMutex

	eventSvc  *events.Service
	workerSvc *workermanager.Service

	statsInFlight atomic.Bool
}

// NewHub creates a new WebSocket Hub
func NewHub(eventSvc *events.Service, workerSvc *workermanager.Service) *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		Broadcast:  make(chan *WSEvent, 256),
		Register:   make(chan *Client),
		Unregister: make(chan *Client),
		eventSvc:   eventSvc,
		workerSvc:  workerSvc,
	}
}

// Start begins processing hub registration and broadcast events
func (h *Hub) Start(ctx context.Context) {
	// Subscribe to internal events (0 = default buffer, EVENT_SUBSCRIBER_BUFFER)
	eventChan := h.eventSvc.Subscribe(0)

	// Ticker for sending WORKER_STATS_UPDATED periodically
	statsInterval := env.Get("WS_STATS_INTERVAL").Default("2s").ValueDuration()
	statsTicker := time.NewTicker(statsInterval)
	defer statsTicker.Stop()

	for {
		select {
		case <-ctx.Done():
			slog.Info("shutting down websocket hub, disconnecting clients")
			h.mu.Lock()
			for client := range h.clients {
				client.closeSend()
				delete(h.clients, client)
			}
			h.mu.Unlock()
			return

		case client := <-h.Register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()
			slog.Debug("websocket client registered", "client_id", client.ID)

			// Send INITIAL_STATE to this newly registered client
			go h.SendInitialState(client)

		case client := <-h.Unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				slog.Debug("websocket client unregistered", "client_id", client.ID)
			}
			h.mu.Unlock()

		case wsEvent := <-h.Broadcast:
			h.broadcastEvent(wsEvent)

		case e := <-eventChan:
			// Map entities.Event to WSEvent and broadcast
			wsEvent := &WSEvent{
				EventType: wsEventTypeFor(e.Type),
				WorkerID:  e.WorkerID.String(),
				Payload:   eventPayload(e),
			}
			h.broadcastEvent(wsEvent)

		case <-statsTicker.C:
			// Fetch and broadcast stats for all workers off the main loop so a
			// slow/unresponsive worker doesn't stall registration/broadcast processing.
			// Skip if a previous run is still in flight to avoid overlapping fetches.
			if h.statsInFlight.CompareAndSwap(false, true) {
				go func() {
					defer h.statsInFlight.Store(false)
					h.broadcastWorkerStats(ctx)
				}()
			}
		}
	}
}

func (h *Hub) SendInitialState(client *Client) {
	defer func() {
		if r := recover(); r != nil {
			slog.Debug("recovered from panic in SendInitialState (client likely disconnected)", "error", r)
		}
	}()

	// Need to fetch all tasks from all workers to build the INITIAL_STATE
	// Note: We use context.Background() since this runs asynchronously
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	result, err := h.workerSvc.ListWorkersTasks(ctx)
	var responseTasks []models.TaskResponseModel
	var workerErrors map[string]string
	if err != nil {
		slog.Error("failed to list workers tasks for initial ws state", "error", err)
		// We proceed with empty tasks to prevent infinite loading in the frontend
		responseTasks = []models.TaskResponseModel{}
	} else if result != nil && result.Tasks != nil {
		responseTasks = make([]models.TaskResponseModel, 0, len(result.Tasks))
		for _, t := range result.Tasks {
			responseTasks = append(responseTasks, mappers.ToTaskResponse(t))
		}
		workerErrors = result.Errors
	} else {
		responseTasks = []models.TaskResponseModel{}
		if result != nil {
			workerErrors = result.Errors
		}
	}

	wsEvent := &WSEvent{
		EventType: "INITIAL_STATE",
		Payload:   responseTasks,
		Errors:    workerErrors,
	}

	h.sendToClient(client, wsEvent)

	// Catch this client up on current worker health so it isn't blind to an
	// already-down worker until the next transition fires.
	h.sendHealthSnapshot(client)
}

// sendToClient sends event to a single client with a timeout, recovering
// from a send on an already-closed channel (the client may disconnect
// concurrently with this call).
func (h *Hub) sendToClient(client *Client, event *WSEvent) {
	defer func() {
		if r := recover(); r != nil {
			slog.Debug("recovered from send on closed client channel", "client_id", client.ID, "error", r)
		}
	}()
	timer := time.NewTimer(5 * time.Second)
	defer timer.Stop()
	select {
	case client.Send <- event:
	case <-timer.C:
		slog.Warn("timeout sending event to client", "client_id", client.ID, "event_type", event.EventType)
	}
}

// sendHealthSnapshot pushes one WORKER_STATUS_CHANGED-shaped event per
// worker with confirmed health to a newly connected client, so it isn't
// blind to current worker status until the next transition occurs. Workers
// with no confirmed health yet (PENDING - no probe has completed) are
// skipped; the client will learn their status from the next transition or
// from a REST fetch.
func (h *Hub) sendHealthSnapshot(client *Client) {
	for workerID, health := range h.workerSvc.HealthSnapshot() {
		if health.Status == "" || health.Status == entities.WorkerStatusPending {
			continue
		}
		h.sendToClient(client, &WSEvent{
			EventType: "WORKER_STATUS_CHANGED",
			WorkerID:  workerID.String(),
			Payload: map[string]interface{}{
				"status":     health.Status,
				"error":      health.Error,
				"error_code": string(health.ErrorCode),
				"permanent":  health.Permanent,
			},
		})
	}
}

func (h *Hub) broadcastWorkerStats(ctx context.Context) {
	// Skip if no clients
	h.mu.RLock()
	clientCount := len(h.clients)
	h.mu.RUnlock()
	if clientCount == 0 {
		return
	}

	// Fetch workers without the per-worker login/health-check ListWorkers does:
	// GetWorkerTasksStats already fails (and suppresses the broadcast) when a
	// worker is unreachable, so the extra availability probe per tick is waste.
	workers, err := h.workerSvc.ListWorkersBasic()
	if err != nil {
		return
	}

	// Fetch stats per worker in parallel with an individual timeout so one
	// slow/hung worker doesn't delay or block stats for the others.
	var wg sync.WaitGroup
	for _, w := range workers {
		wg.Add(1)
		go func(workerID string) {
			defer wg.Done()
			statsCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
			defer cancel()

			stats, err := h.workerSvc.GetWorkerTasksStats(statsCtx, workerID)
			if err != nil {
				return
			}
			h.broadcastEvent(&WSEvent{
				EventType: "WORKER_STATS_UPDATED",
				WorkerID:  workerID,
				Payload:   stats,
			})
		}(w.UUID.String())
	}
	wg.Wait()
}

func (h *Hub) broadcastEvent(event *WSEvent) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	for client := range h.clients {
		func(c *Client) {
			defer func() {
				if r := recover(); r != nil {
					slog.Debug("recovered from send on closed client channel", "client_id", c.ID, "error", r)
				}
			}()
			select {
			case c.Send <- event:
			default:
				// if send buffer is full, we could drop the client, but for now just drop the message
				slog.Warn("websocket buffer full, dropping message", "client_id", c.ID)
			}
		}(client)
	}
}

// DropSession forcefully disconnects all clients associated with a given session token
func (h *Hub) DropSession(sessionToken string) {
	h.mu.RLock()
	var toDrop []*Client
	for client := range h.clients {
		if client.SessionID == sessionToken {
			toDrop = append(toDrop, client)
		}
	}
	h.mu.RUnlock()

	for _, client := range toDrop {
		slog.Info("Dropping WS client due to session termination", "client_id", client.ID)
		go client.Close()
	}
}
