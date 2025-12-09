package events

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jfxdev/gardarr/internal/constants"
	"github.com/jfxdev/gardarr/internal/entities"
	"github.com/jfxdev/gardarr/internal/infra/database"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestEnableRealTimeEmission(t *testing.T) {
	// Create a minimal service for testing
	svc := &Service{
		taskStates: make(map[uuid.UUID]map[string]*entities.TaskState),
	}

	// Initially nil
	assert.Nil(t, svc.eventChan)

	// Enable with default buffer (0 should default to 100)
	ch := svc.EnableRealTimeEmission(0)
	assert.NotNil(t, ch)
	assert.NotNil(t, svc.eventChan)
	assert.Equal(t, 100, cap(svc.eventChan))

	// Create new service and test with custom buffer
	svc2 := &Service{
		taskStates: make(map[uuid.UUID]map[string]*entities.TaskState),
	}
	ch2 := svc2.EnableRealTimeEmission(50)
	assert.NotNil(t, ch2)
	assert.Equal(t, 50, cap(svc2.eventChan))
}

func TestEnableRealTimeEmissionMultipleBufferSizes(t *testing.T) {
	tests := []struct {
		name       string
		bufferSize int
		expected   int
	}{
		{"Zero defaults to 100", 0, 100},
		{"Negative defaults to 100", -5, 100},
		{"Custom size 50", 50, 50},
		{"Custom size 200", 200, 200},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &Service{
				taskStates: make(map[uuid.UUID]map[string]*entities.TaskState),
			}
			ch := svc.EnableRealTimeEmission(tt.bufferSize)
			assert.NotNil(t, ch)
			assert.Equal(t, tt.expected, cap(svc.eventChan))
		})
	}
}

func TestIsSignificantStateChange(t *testing.T) {
	tests := []struct {
		name        string
		oldState    string
		newState    string
		significant bool
	}{
		// Upload states - not significant
		{
			name:        "UPLOADING to STALLED_UPLOAD - not significant",
			oldState:    constants.TaskStatusUploading,
			newState:    constants.TaskStatusStalledUpload,
			significant: false,
		},
		{
			name:        "STALLED_UPLOAD to UPLOADING - not significant",
			oldState:    constants.TaskStatusStalledUpload,
			newState:    constants.TaskStatusUploading,
			significant: false,
		},
		// Download states - not significant
		{
			name:        "DOWNLOADING to STALLED_DOWNLOAD - not significant",
			oldState:    constants.TaskStatusDownloading,
			newState:    constants.TaskStatusStalledDownload,
			significant: false,
		},
		{
			name:        "STALLED_DOWNLOAD to DOWNLOADING - not significant",
			oldState:    constants.TaskStatusStalledDownload,
			newState:    constants.TaskStatusDownloading,
			significant: false,
		},
		// Different state groups - significant
		{
			name:        "DOWNLOADING to UPLOADING - significant",
			oldState:    constants.TaskStatusDownloading,
			newState:    constants.TaskStatusUploading,
			significant: true,
		},
		{
			name:        "UPLOADING to ERROR - significant",
			oldState:    constants.TaskStatusUploading,
			newState:    constants.TaskStatusError,
			significant: true,
		},
		{
			name:        "STALLED_UPLOAD to ERROR - significant",
			oldState:    constants.TaskStatusStalledUpload,
			newState:    constants.TaskStatusError,
			significant: true,
		},
		{
			name:        "ERROR to UPLOADING - significant",
			oldState:    constants.TaskStatusError,
			newState:    constants.TaskStatusUploading,
			significant: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isSignificantStateChange(tt.oldState, tt.newState)
			assert.Equal(t, tt.significant, result)
		})
	}
}

func TestIsErrorState(t *testing.T) {
	tests := []struct {
		name    string
		state   string
		isError bool
	}{
		{
			name:    "ERROR state",
			state:   constants.TaskStatusError,
			isError: true,
		},
		{
			name:    "MISSING_FILES state",
			state:   constants.TaskStatusMissingFiles,
			isError: true,
		},
		{
			name:    "UPLOADING is not error",
			state:   constants.TaskStatusUploading,
			isError: false,
		},
		{
			name:    "DOWNLOADING is not error",
			state:   constants.TaskStatusDownloading,
			isError: false,
		},
		{
			name:    "STALLED_UPLOAD is not error",
			state:   constants.TaskStatusStalledUpload,
			isError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isErrorState(tt.state)
			assert.Equal(t, tt.isError, result)
		})
	}
}

func TestLoadStates(t *testing.T) {
	db := database.SetupTestDBWithMigrations(t)
	svc, err := NewService(db)
	require.NoError(t, err)
	ctx := context.Background()

	// Initially should have empty states (loaded from empty DB)
	assert.NotNil(t, svc.taskStates)

	// Add some states to the database
	agentID := uuid.New()
	hash1 := "test-hash-1"
	hash2 := "test-hash-2"

	err = svc.repo.SaveTaskState(ctx, agentID, hash1, constants.TaskStatusUploading, 0.5, time.Now())
	require.NoError(t, err)

	err = svc.repo.SaveTaskState(ctx, agentID, hash2, constants.TaskStatusDownloading, 0.75, time.Now())
	require.NoError(t, err)

	// Reload states
	err = svc.LoadStates(ctx)
	require.NoError(t, err)

	// Verify states were loaded
	svc.mu.RLock()
	defer svc.mu.RUnlock()

	assert.Contains(t, svc.taskStates, agentID)
	assert.Contains(t, svc.taskStates[agentID], hash1)
	assert.Contains(t, svc.taskStates[agentID], hash2)

	state1 := svc.taskStates[agentID][hash1]
	assert.Equal(t, constants.TaskStatusUploading, state1.State)
	assert.Equal(t, 0.5, state1.Progress)

	state2 := svc.taskStates[agentID][hash2]
	assert.Equal(t, constants.TaskStatusDownloading, state2.State)
	assert.Equal(t, 0.75, state2.Progress)
}

func TestTrackTasks_NewTask(t *testing.T) {
	db := database.SetupTestDBWithMigrations(t)
	svc, err := NewService(db)
	require.NoError(t, err)
	ctx := context.Background()

	agentID := uuid.New()
	timestamp := time.Now()

	tasks := []*entities.Task{
		{
			Hash:     "new-task-hash",
			Name:     "New Task",
			State:    constants.TaskStatusDownloading,
			Progress: 0.25,
		},
	}

	err = svc.TrackTasks(ctx, tasks, agentID, timestamp)
	require.NoError(t, err)

	// Verify state was saved in memory
	svc.mu.RLock()
	state := svc.taskStates[agentID]["new-task-hash"]
	svc.mu.RUnlock()

	assert.NotNil(t, state)
	assert.Equal(t, constants.TaskStatusDownloading, state.State)
	assert.Equal(t, 0.25, state.Progress)

	// Verify state was persisted to database
	states, err := svc.repo.LoadTaskStates(ctx, agentID)
	require.NoError(t, err)
	assert.Contains(t, states, "new-task-hash")
}

func TestTrackTasks_SignificantStateChange(t *testing.T) {
	db := database.SetupTestDBWithMigrations(t)
	svc, err := NewService(db)
	require.NoError(t, err)
	ctx := context.Background()

	agentID := uuid.New()
	taskHash := "test-hash"

	// Set initial state
	svc.mu.Lock()
	svc.taskStates[agentID] = map[string]*entities.TaskState{
		taskHash: {
			AgentID:   agentID,
			Hash:      taskHash,
			State:     constants.TaskStatusDownloading,
			Progress:  0.5,
			UpdatedAt: time.Now(),
		},
	}
	svc.mu.Unlock()

	// Track task with significant state change (DOWNLOADING -> UPLOADING)
	tasks := []*entities.Task{
		{
			Hash:     taskHash,
			Name:     "Test Task",
			State:    constants.TaskStatusUploading,
			Progress: 1.0,
		},
	}

	err = svc.TrackTasks(ctx, tasks, agentID, time.Now())
	require.NoError(t, err)

	// Verify state was updated
	svc.mu.RLock()
	state := svc.taskStates[agentID][taskHash]
	svc.mu.RUnlock()

	assert.Equal(t, constants.TaskStatusUploading, state.State)
	assert.Equal(t, 1.0, state.Progress)
}

func TestTrackTasks_InsignificantStateChange(t *testing.T) {
	db := database.SetupTestDBWithMigrations(t)
	svc, err := NewService(db)
	require.NoError(t, err)
	ctx := context.Background()

	agentID := uuid.New()
	taskHash := "test-hash"

	// Set initial state
	svc.mu.Lock()
	svc.taskStates[agentID] = map[string]*entities.TaskState{
		taskHash: {
			AgentID:   agentID,
			Hash:      taskHash,
			State:     constants.TaskStatusUploading,
			Progress:  0.5,
			UpdatedAt: time.Now(),
		},
	}
	svc.mu.Unlock()

	// Track task with insignificant state change (UPLOADING -> STALLED_UPLOAD)
	tasks := []*entities.Task{
		{
			Hash:     taskHash,
			Name:     "Test Task",
			State:    constants.TaskStatusStalledUpload,
			Progress: 0.5,
		},
	}

	err = svc.TrackTasks(ctx, tasks, agentID, time.Now())
	require.NoError(t, err)

	// Verify state was updated in memory
	svc.mu.RLock()
	state := svc.taskStates[agentID][taskHash]
	svc.mu.RUnlock()

	assert.Equal(t, constants.TaskStatusStalledUpload, state.State)

	// Verify state was persisted to database even for insignificant changes
	states, err := svc.repo.LoadTaskStates(ctx, agentID)
	require.NoError(t, err)
	assert.Equal(t, constants.TaskStatusStalledUpload, states[taskHash].State)
}
