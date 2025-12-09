package events

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jfxdev/gardarr/internal/constants"
	"github.com/jfxdev/gardarr/internal/entities"
	"github.com/jfxdev/gardarr/internal/infra/database"
	"github.com/jfxdev/gardarr/internal/repository/event"
	"github.com/jfxdev/gardarr/pkg/env"
)

const (
	// Log messages
	logMsgFailedToSaveTaskState   = "failed to save task state"
	logMsgFailedToDeleteTaskState = "failed to delete task state from database"
)

// Service handles event tracking and state change detection
type Service struct {
	repo          *event.Repository
	taskStates    map[uuid.UUID]map[string]*entities.TaskState // agentID -> taskHash -> state
	mu            sync.RWMutex
	retentionDays int
	eventChan     chan *entities.Event // Optional channel for real-time event emission
}

// NewService creates a new event service and loads existing state from database
// Returns error if state loading fails to ensure consistent initialization
func NewService(db *database.Database) (*Service, error) {
	s := &Service{
		repo:          event.NewRepository(db),
		taskStates:    make(map[uuid.UUID]map[string]*entities.TaskState),
		retentionDays: env.Get("EVENT_RETENTION_DAYS").Default(7).ValueInt(),
		eventChan:     nil, // Initially nil, enabled via EnableRealTimeEmission
	}

	// Load existing task states from database - fail fast if this fails
	if err := s.LoadStates(context.Background()); err != nil {
		return nil, fmt.Errorf("failed to load task states from database: %w", err)
	}

	return s, nil
}

// LoadStates loads all task states from the database into memory
func (s *Service) LoadStates(ctx context.Context) error {
	states, err := s.repo.LoadAllTaskStates(ctx)
	if err != nil {
		return err
	}

	s.mu.Lock()
	s.taskStates = states
	s.mu.Unlock()

	slog.Info("task states loaded from database",
		"agents", len(states),
	)

	return nil
}

// EnableRealTimeEmission creates and returns a channel for real-time event emission.
// This allows consumers (like integration services) to receive events as they occur.
// Call this only once during service initialization.
func (s *Service) EnableRealTimeEmission(bufferSize int) <-chan *entities.Event {
	if bufferSize <= 0 {
		bufferSize = 100
	}
	s.eventChan = make(chan *entities.Event, bufferSize)
	return s.eventChan
}

// isErrorState checks if a state represents an error condition
func isErrorState(state string) bool {
	return state == constants.TaskStatusError || state == constants.TaskStatusMissingFiles
}

// isSignificantStateChange checks if a state change is significant enough to generate an event
// Some state changes are trivial (like STALLED_UPLOAD <-> UPLOADING) and happen frequently
func isSignificantStateChange(oldState, newState string) bool {
	// Define state groups that are considered similar
	uploadStates := map[string]bool{
		constants.TaskStatusUploading:     true,
		constants.TaskStatusStalledUpload: true,
	}

	downloadStates := map[string]bool{
		constants.TaskStatusDownloading:     true,
		constants.TaskStatusStalledDownload: true,
	}

	// If both states are in the same group, it's not significant
	if uploadStates[oldState] && uploadStates[newState] {
		return false
	}

	if downloadStates[oldState] && downloadStates[newState] {
		return false
	}

	// All other state changes are significant
	return true
}

// stateUpdate represents a pending state update to be persisted
type stateUpdate struct {
	hash      string
	state     string
	progress  float64
	timestamp time.Time
}

// TrackTasks processes current tasks and detects state changes
func (s *Service) TrackTasks(ctx context.Context, tasks []*entities.Task, agentID uuid.UUID, timestamp time.Time) error {
	if len(tasks) == 0 {
		return nil
	}

	// Channels for collecting updates and events
	eventsChan := make(chan *entities.Event, len(tasks)*2)
	updatesChan := make(chan stateUpdate, len(tasks))

	// First pass: update in-memory state and collect changes (minimal lock time)
	for _, task := range tasks {
		func(t *entities.Task) {
			s.mu.Lock()
			defer s.mu.Unlock()

			// Ensure agent map exists
			if s.taskStates[agentID] == nil {
				s.taskStates[agentID] = make(map[string]*entities.TaskState)
			}

			lastState, exists := s.taskStates[agentID][t.Hash]

			// Debug log for state comparison
			if exists {
				slog.Debug("task state comparison",
					"task_hash", t.Hash,
					"task_name", t.Name,
					"old_state", lastState.State,
					"new_state", t.State,
					"old_progress", lastState.Progress,
					"new_progress", t.Progress,
				)
			}

			// New task detected
			if !exists {
				s.taskStates[agentID][t.Hash] = &entities.TaskState{
					AgentID:   agentID,
					Hash:      t.Hash,
					State:     t.State,
					Progress:  t.Progress,
					UpdatedAt: timestamp,
				}

				// Queue for persistence
				updatesChan <- stateUpdate{
					hash:      t.Hash,
					state:     t.State,
					progress:  t.Progress,
					timestamp: timestamp,
				}

				// Create task added event
				eventsChan <- &entities.Event{
					UUID:      uuid.New(),
					AgentID:   agentID,
					Type:      constants.EventTypeTorrentAdded,
					TaskHash:  t.Hash,
					NewValue:  t.State,
					Metadata:  s.buildBaseMetadata(t),
					CreatedAt: timestamp,
				}
				return
			}

			// State change detected
			if lastState.State != t.State {
				oldState := lastState.State
				oldProgress := lastState.Progress
				wasCompleted := lastState.Progress >= 1.0

				// Update state in memory
				lastState.State = t.State
				lastState.Progress = t.Progress
				lastState.UpdatedAt = timestamp

				// Queue for persistence
				updatesChan <- stateUpdate{
					hash:      t.Hash,
					state:     t.State,
					progress:  t.Progress,
					timestamp: timestamp,
				}

				// Check if this is a significant state change
				if !isSignificantStateChange(oldState, t.State) {
					slog.Debug("insignificant state change ignored",
						"task_name", t.Name,
						"task_hash", t.Hash,
						"old_state", oldState,
						"new_state", t.State,
					)
					return
				}

				slog.Info("state change detected",
					"task_name", t.Name,
					"task_hash", t.Hash,
					"old_state", oldState,
					"new_state", t.State,
					"old_progress", oldProgress,
					"new_progress", t.Progress,
				)

				// Create state change event
				eventsChan <- &entities.Event{
					UUID:      uuid.New(),
					AgentID:   agentID,
					Type:      constants.EventTypeTorrentStateChange,
					TaskHash:  t.Hash,
					OldValue:  oldState,
					NewValue:  t.State,
					Metadata:  s.buildStateChangeMetadata(t, oldProgress),
					CreatedAt: timestamp,
				}

				// Check if task just completed
				if t.Progress >= 1.0 && !wasCompleted && !isErrorState(t.State) {
					eventsChan <- &entities.Event{
						UUID:      uuid.New(),
						AgentID:   agentID,
						Type:      constants.EventTypeTorrentCompleted,
						TaskHash:  t.Hash,
						NewValue:  t.State,
						Metadata:  s.buildBaseMetadata(t),
						CreatedAt: timestamp,
					}
				}
			} else if lastState.Progress != t.Progress {
				// Progress changed but state didn't
				oldProgress := lastState.Progress
				wasCompleted := oldProgress >= 1.0

				lastState.Progress = t.Progress
				lastState.UpdatedAt = timestamp

				// Queue for persistence
				updatesChan <- stateUpdate{
					hash:      t.Hash,
					state:     t.State,
					progress:  t.Progress,
					timestamp: timestamp,
				}

				// Check if task just reached 100%
				if t.Progress >= 1.0 && !wasCompleted && !isErrorState(t.State) {
					eventsChan <- &entities.Event{
						UUID:      uuid.New(),
						AgentID:   agentID,
						Type:      constants.EventTypeTorrentCompleted,
						TaskHash:  t.Hash,
						NewValue:  t.State,
						Metadata:  s.buildBaseMetadata(t),
						CreatedAt: timestamp,
					}
				}
			}
		}(task)
	}

	close(updatesChan)
	close(eventsChan)

	// Second pass: persist all updates to database (no lock held)
	var wg sync.WaitGroup
	for update := range updatesChan {
		wg.Add(1)
		go func(u stateUpdate) {
			defer wg.Done()
			if err := s.repo.SaveTaskState(ctx, agentID, u.hash, u.state, u.progress, u.timestamp); err != nil {
				slog.Error(logMsgFailedToSaveTaskState,
					"error", err,
					"agent_id", agentID.String(),
					"task_hash", u.hash,
				)
			}
		}(update)
	}
	wg.Wait()

	// Process events
	s.processEvents(ctx, eventsChan, agentID)

	return nil
}

func (s *Service) buildStateChangeMetadata(t *entities.Task, oldProgress float64) map[string]interface{} {
	m := s.buildBaseMetadata(t)
	m["old_progress"] = oldProgress
	m["new_progress"] = t.Progress
	return m
}

// buildBaseMetadata creates the common metadata map for a task
func (s *Service) buildBaseMetadata(t *entities.Task) map[string]interface{} {
	return map[string]interface{}{
		"name":      t.Name,
		"hash":      t.Hash,
		"state":     t.State,
		"category":  t.Category,
		"tags":      t.Tags,
		"directory": t.Path,
		"size":      t.Size,
		"progress":  t.Progress,
		"ratio":     t.Ratio,
	}
}

// processEvents handles event persistence and real-time emission
func (s *Service) processEvents(ctx context.Context, eventsChan <-chan *entities.Event, agentID uuid.UUID) {
	for event := range eventsChan {
		if err := s.repo.CreateEvent(ctx, event); err != nil {
			slog.Error("failed to create event",
				"error", err,
				"agent_id", agentID.String(),
				"event_type", event.Type,
				"task_hash", event.TaskHash,
			)
			continue
		}

		// Emit to real-time channel if enabled (non-blocking)
		if s.eventChan != nil {
			select {
			case s.eventChan <- event:
			default:
				// Channel full - skip emission to prevent blocking
			}
		}
	}
}

// DetectRemovedTasks checks for tasks that are no longer present concurrently
func (s *Service) DetectRemovedTasks(ctx context.Context, currentTasks []*entities.Task, agentID uuid.UUID, timestamp time.Time) error {
	// Build map of current task hashes
	currentHashes := make(map[string]bool)
	for _, task := range currentTasks {
		currentHashes[task.Hash] = true
	}

	s.mu.Lock()
	// Collect hashes to check for this specific agent
	var hashesToCheck []string
	if agentTasks, exists := s.taskStates[agentID]; exists {
		for hash := range agentTasks {
			if !currentHashes[hash] {
				hashesToCheck = append(hashesToCheck, hash)
			}
		}
	}
	s.mu.Unlock()

	if len(hashesToCheck) == 0 {
		return nil
	}

	// Use buffered channel to collect events
	eventsChan := make(chan *entities.Event, len(hashesToCheck))
	removedHashes := make(chan string, len(hashesToCheck))
	var wg sync.WaitGroup

	// Process removed tasks concurrently
	for _, hash := range hashesToCheck {
		wg.Add(1)
		go func(h string) {
			defer wg.Done()

			// Copy fields under lock to avoid data race
			s.mu.RLock()
			state, exists := s.taskStates[agentID][h]
			var lastState string
			var lastProgress float64
			if exists {
				lastState = state.State
				lastProgress = state.Progress
			}
			s.mu.RUnlock()

			if !exists {
				return
			}

			// Task removed - create event (using copied values)
			eventsChan <- &entities.Event{
				UUID:     uuid.New(),
				AgentID:  agentID,
				Type:     constants.EventTypeTorrentRemoved,
				TaskHash: h,
				OldValue: lastState,
				Metadata: map[string]interface{}{
					"last_progress": lastProgress,
				},
				CreatedAt: timestamp,
			}

			// Mark for removal
			removedHashes <- h
		}(hash)
	}

	// Close channels when all goroutines complete
	go func() {
		wg.Wait()
		close(eventsChan)
		close(removedHashes)
	}()

	// Process events
	s.processEvents(ctx, eventsChan, agentID)

	// Remove from tracked states (under lock) and collect hashes for DB deletion
	var hashesToDelete []string
	s.mu.Lock()
	if agentTasks, exists := s.taskStates[agentID]; exists {
		for hash := range removedHashes {
			if _, taskExists := agentTasks[hash]; taskExists {
				delete(agentTasks, hash)
				hashesToDelete = append(hashesToDelete, hash)
			}
		}
	}
	s.mu.Unlock()

	// Delete from database (no lock held)
	for _, hash := range hashesToDelete {
		if err := s.repo.DeleteTaskState(ctx, agentID, hash); err != nil {
			slog.Error(logMsgFailedToDeleteTaskState,
				"error", err,
				"agent_id", agentID.String(),
				"task_hash", hash,
			)
		}
	}

	return nil
}

// ListEvents retrieves events with optional filters
func (s *Service) ListEvents(ctx context.Context, agentID *uuid.UUID, eventType *string, limit int, offset int) ([]*entities.Event, int64, error) {
	return s.repo.ListEvents(ctx, agentID, eventType, limit, offset)
}

// GetEventByUUID retrieves an event by its UUID
func (s *Service) GetEventByUUID(ctx context.Context, uuid uuid.UUID) (*entities.Event, error) {
	return s.repo.GetEventByUUID(ctx, uuid)
}

// PurgeOldEvents deletes events older than retention period
func (s *Service) PurgeOldEvents(ctx context.Context) error {
	if s.retentionDays <= 0 {
		return nil
	}

	cutoff := time.Now().UTC().AddDate(0, 0, -s.retentionDays)
	return s.repo.DeleteOldEvents(ctx, cutoff)
}

// CleanStaleStates removes states for tasks not seen in the last 24 hours
func (s *Service) CleanStaleStates(ctx context.Context) {
	cutoff := time.Now().Add(-24 * time.Hour)

	// Clean from database
	if err := s.repo.DeleteOldTaskStates(ctx, cutoff); err != nil {
		slog.Error("failed to delete old task states from database", "error", err)
	}

	// Clean from memory
	s.mu.Lock()
	defer s.mu.Unlock()

	for agentID, agentTasks := range s.taskStates {
		for hash, state := range agentTasks {
			if state.UpdatedAt.Before(cutoff) {
				delete(agentTasks, hash)
			}
		}
		// Remove empty agent maps
		if len(agentTasks) == 0 {
			delete(s.taskStates, agentID)
		}
	}
}
