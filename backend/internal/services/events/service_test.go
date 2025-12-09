package events

import (
	"testing"

	"github.com/google/uuid"
	"github.com/jfxdev/gardarr/internal/entities"
	"github.com/stretchr/testify/assert"
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
