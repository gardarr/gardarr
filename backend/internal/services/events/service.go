package events

import (
	"context"
	"sync"
	"time"

	"github.com/gardarr/gardarr/internal/constants"
	"github.com/gardarr/gardarr/internal/entities"
	"github.com/gardarr/gardarr/internal/infra/database"
	"github.com/gardarr/gardarr/internal/repository/event"
	"github.com/gardarr/gardarr/pkg/env"
	"github.com/google/uuid"
)

// Service handles event tracking and state change detection
type Service struct {
	repo          *event.Repository
	taskStates    map[string]*TaskState // taskHash -> state
	mu            sync.RWMutex
	retentionDays int
}

// TaskState represents the last known state of a task
type TaskState struct {
	AgentID   uuid.UUID
	Hash      string
	State     string
	Progress  float64
	UpdatedAt time.Time
}

// NewService creates a new event service
func NewService(db *database.Database) *Service {
	return &Service{
		repo:          event.NewRepository(db),
		taskStates:    make(map[string]*TaskState),
		retentionDays: env.Get("EVENT_RETENTION_DAYS").Default(7).ValueInt(),
	}
}

// isErrorState checks if a state represents an error condition
func isErrorState(state string) bool {
	errorStates := []string{
		"ERROR",
		"MISSING_FILES",
		"MISSINGFILES",
	}
	
	for _, errState := range errorStates {
		if state == errState {
			return true
		}
	}
	return false
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
			lastState, exists := s.taskStates[t.Hash]

			// New task detected
			if !exists {
				s.taskStates[t.Hash] = &TaskState{
					AgentID:   agentID,
					Hash:      t.Hash,
					State:     t.State,
					Progress:  t.Progress,
					UpdatedAt: timestamp,
				}
				s.mu.Unlock()

				// Create task added event
				eventsChan <- &entities.Event{
					UUID:     uuid.New(),
					AgentID:  agentID,
					Type:     constants.EventTypeTorrentAdded,
					TaskHash: t.Hash,
					NewValue: t.State,
					Metadata: map[string]interface{}{
						"name":     t.Name,
						"progress": t.Progress,
					},
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

				// Update state
				lastState.State = t.State
				lastState.Progress = t.Progress
				lastState.UpdatedAt = timestamp
				s.mu.Unlock()

				// Create state change event
				eventsChan <- &entities.Event{
					UUID:     uuid.New(),
					AgentID:  agentID,
					Type:     constants.EventTypeTorrentStateChange,
					TaskHash: t.Hash,
					OldValue: oldState,
					NewValue: t.State,
					Metadata: map[string]interface{}{
						"name":         t.Name,
						"old_progress": oldProgress,
						"new_progress": t.Progress,
					},
					CreatedAt: timestamp,
				}

				// Check if task just completed (100% and not an error state)
				if t.Progress >= 1.0 && !wasCompleted && !isErrorState(t.State) {
					eventsChan <- &entities.Event{
						UUID:     uuid.New(),
						AgentID:  agentID,
						Type:     constants.EventTypeTorrentCompleted,
						TaskHash: t.Hash,
						NewValue: t.State,
						Metadata: map[string]interface{}{
							"name": t.Name,
						},
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

				// Check if task just reached 100% (not an error state)
				if t.Progress >= 1.0 && !wasCompleted && !isErrorState(t.State) {
					eventsChan <- &entities.Event{
						UUID:     uuid.New(),
						AgentID:  agentID,
						Type:     constants.EventTypeTorrentCompleted,
						TaskHash: t.Hash,
						NewValue: t.State,
						Metadata: map[string]interface{}{
							"name": t.Name,
						},
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

	// Create events from channel
	for event := range eventsChan {
		if err := s.repo.CreateEvent(ctx, event); err != nil {
			// Log error but continue
			continue
		}
	}

	return nil
}

// DetectRemovedTasks checks for tasks that are no longer present concurrently
func (s *Service) DetectRemovedTasks(ctx context.Context, currentTasks []*entities.Task, agentID uuid.UUID, timestamp time.Time) error {
	// Build map of current task hashes
	currentHashes := make(map[string]bool)
	for _, task := range currentTasks {
		currentHashes[task.Hash] = true
	}

	s.mu.Lock()
	// Collect hashes to check
	var hashesToCheck []string
	for hash, state := range s.taskStates {
		if state.AgentID == agentID && !currentHashes[hash] {
			hashesToCheck = append(hashesToCheck, hash)
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
			state, exists := s.taskStates[h]
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

	// Create events from channel
	for event := range eventsChan {
		if err := s.repo.CreateEvent(ctx, event); err != nil {
			// Log error but continue
			continue
		}
	}

	// Remove from tracked states
	s.mu.Lock()
	for hash := range removedHashes {
		delete(s.taskStates, hash)
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
func (s *Service) CleanStaleStates() {
	s.mu.Lock()
	defer s.mu.Unlock()

	cutoff := time.Now().Add(-24 * time.Hour)
	for hash, state := range s.taskStates {
		if state.UpdatedAt.Before(cutoff) {
			delete(s.taskStates, hash)
		}
	}
}
