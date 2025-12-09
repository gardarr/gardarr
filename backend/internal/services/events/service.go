package events

import (
	"context"
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

// Service handles event tracking and state change detection
type Service struct {
	repo          *event.Repository
	taskStates    map[uuid.UUID]map[string]*entities.TaskState // agentID -> taskHash -> state
	mu            sync.RWMutex
	retentionDays int
	eventChan     chan *entities.Event // Optional channel for real-time event emission
}

// NewService creates a new event service
func NewService(db *database.Database) *Service {
	s := &Service{
		repo:          event.NewRepository(db),
		taskStates:    make(map[uuid.UUID]map[string]*entities.TaskState),
		retentionDays: env.Get("EVENT_RETENTION_DAYS").Default(7).ValueInt(),
		eventChan:     nil, // Initially nil, enabled via EnableRealTimeEmission
	}

	// Load existing task states from database
	if err := s.LoadStates(context.Background()); err != nil {
		slog.Error("failed to load task states from database", "error", err)
	}

	return s
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

// TrackTasks processes current tasks and detects state changes concurrently
func (s *Service) TrackTasks(ctx context.Context, tasks []*entities.Task, agentID uuid.UUID, timestamp time.Time) error {
	if len(tasks) == 0 {
		return nil
	}

	// Use buffered channel to collect events to create
	eventsChan := make(chan *entities.Event, len(tasks)*2) // *2 for state change + completed
	var wg sync.WaitGroup

	// Process each task concurrently
	for _, task := range tasks {
		wg.Add(1)
		go func(t *entities.Task) {
			defer wg.Done()

			s.mu.Lock()
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
				s.mu.Unlock()

				// Persist state to database
				if err := s.repo.SaveTaskState(ctx, agentID, t.Hash, t.State, t.Progress, timestamp); err != nil {
					slog.Error("failed to save task state",
						"error", err,
						"agent_id", agentID.String(),
						"task_hash", t.Hash,
					)
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
				// Save old values before updating
				oldState := lastState.State
				oldProgress := lastState.Progress
				wasCompleted := lastState.Progress >= 1.0

				// Check if this is a significant state change
				if !isSignificantStateChange(oldState, t.State) {
					slog.Debug("insignificant state change ignored",
						"task_name", t.Name,
						"task_hash", t.Hash,
						"old_state", oldState,
						"new_state", t.State,
					)

					// Update state in memory and database but don't generate event
					lastState.State = t.State
					lastState.Progress = t.Progress
					lastState.UpdatedAt = timestamp
					s.mu.Unlock()

					// Persist state change to database
					if err := s.repo.SaveTaskState(ctx, agentID, t.Hash, t.State, t.Progress, timestamp); err != nil {
						slog.Error("failed to save task state",
							"error", err,
							"agent_id", agentID.String(),
							"task_hash", t.Hash,
						)
					}
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

				// Update state
				lastState.State = t.State
				lastState.Progress = t.Progress
				lastState.UpdatedAt = timestamp
				s.mu.Unlock()

				// Persist state change to database
				if err := s.repo.SaveTaskState(ctx, agentID, t.Hash, t.State, t.Progress, timestamp); err != nil {
					slog.Error("failed to save task state",
						"error", err,
						"agent_id", agentID.String(),
						"task_hash", t.Hash,
					)
				}

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

				// Check if task just completed (100% and not an error state)
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
			} else {
				// No state change, but check for progress completion
				oldProgress := lastState.Progress
				wasCompleted := oldProgress >= 1.0

				// Update progress and timestamp
				lastState.Progress = t.Progress
				lastState.UpdatedAt = timestamp
				s.mu.Unlock()

				// Persist progress update to database (only if progress changed)
				if oldProgress != t.Progress {
					if err := s.repo.SaveTaskState(ctx, agentID, t.Hash, t.State, t.Progress, timestamp); err != nil {
						slog.Error("failed to save task state",
							"error", err,
							"agent_id", agentID.String(),
							"task_hash", t.Hash,
						)
					}
				}

				// Check if task just reached 100% (not an error state)
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

	// Close channel when all goroutines complete
	go func() {
		wg.Wait()
		close(eventsChan)
	}()

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

			s.mu.RLock()
			state, exists := s.taskStates[agentID][h]
			s.mu.RUnlock()

			if !exists {
				return
			}

			// Task removed - create event
			eventsChan <- &entities.Event{
				UUID:     uuid.New(),
				AgentID:  agentID,
				Type:     constants.EventTypeTorrentRemoved,
				TaskHash: h,
				OldValue: state.State,
				Metadata: map[string]interface{}{
					"last_progress": state.Progress,
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

	// Remove from tracked states and database
	s.mu.Lock()
	for hash := range removedHashes {
		delete(s.taskStates[agentID], hash)

		// Delete from database
		if err := s.repo.DeleteTaskState(ctx, agentID, hash); err != nil {
			slog.Error("failed to delete task state from database",
				"error", err,
				"agent_id", agentID.String(),
				"task_hash", hash,
			)
		}
	}
	s.mu.Unlock()

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
