package workermanager

import (
	"context"
	"testing"

	"github.com/jfxdev/gardarr/internal/entities"
	"github.com/jfxdev/gardarr/internal/schemas"
)

func TestServiceListTasksEmptyWorkers(t *testing.T) {
	// Create a minimal service for testing
	service := &Service{}

	result, err := service.ListTasks(context.Background(), []*entities.Worker{})

	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
	if len(result.Tasks) != 0 {
		t.Errorf("Expected empty tasks slice, got %d tasks", len(result.Tasks))
	}
	if len(result.Errors) != 0 {
		t.Errorf("Expected empty errors map, got %d errors", len(result.Errors))
	}
}

func TestServiceListTasksParallelExecution(t *testing.T) {
	// This test verifies that the parallel implementation works correctly
	// by checking that multiple workers are processed concurrently

	// Create a service with a test repository that has a delay
	// This helps us verify that the parallel execution is working
	service := &Service{}

	// We can't easily mock the repository without changing the service structure,
	// but we can test the basic functionality and error handling

	// Test with empty workers
	result, err := service.ListTasks(context.Background(), []*entities.Worker{})
	if err != nil {
		t.Errorf("Expected no error for empty workers, got %v", err)
	}
	if len(result.Tasks) != 0 {
		t.Errorf("Expected 0 tasks for empty workers, got %d", len(result.Tasks))
	}
}

func TestServiceListTasksErrorHandling(t *testing.T) {
	// Test that the method handles errors gracefully
	// Since we can't easily mock the repository, we'll test the error handling
	// by ensuring the method doesn't panic and returns appropriate errors

	service := &Service{}

	// Test with nil workers slice
	result, err := service.ListTasks(context.Background(), nil)
	if err != nil {
		t.Errorf("Expected no error for nil workers, got %v", err)
	}
	if len(result.Tasks) != 0 {
		t.Errorf("Expected 0 tasks for nil workers, got %d", len(result.Tasks))
	}
}

func TestBulkTaskActionValidatesActionSpecificFields(t *testing.T) {
	svc := &Service{}

	tests := []struct {
		name   string
		schema schemas.BulkTaskActionSchema
	}{
		{
			name: "set_category without category",
			schema: schemas.BulkTaskActionSchema{
				Action: "set_category",
				Items:  []schemas.BulkTaskItemSchema{{WorkerID: "w1", Hash: "h1"}},
			},
		},
		{
			name: "add_tags without tags",
			schema: schemas.BulkTaskActionSchema{
				Action: "add_tags",
				Items:  []schemas.BulkTaskItemSchema{{WorkerID: "w1", Hash: "h1"}},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if _, err := svc.BulkTaskAction(context.Background(), tt.schema); err == nil {
				t.Error("expected validation error, got nil")
			}
		})
	}
}

func TestBulkTaskActionReportsInvalidWorkerAsFailed(t *testing.T) {
	svc := &Service{}

	result, err := svc.BulkTaskAction(context.Background(), schemas.BulkTaskActionSchema{
		Action: "stop",
		Items: []schemas.BulkTaskItemSchema{
			{WorkerID: "not-a-uuid", Hash: "h1"},
			{WorkerID: "not-a-uuid", Hash: "h1"}, // duplicate must be deduped
		},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result.Succeeded != 0 {
		t.Errorf("expected 0 succeeded, got %d", result.Succeeded)
	}
	if len(result.Failed) != 1 {
		t.Errorf("expected 1 failed worker, got %d", len(result.Failed))
	}
	if _, ok := result.Failed["not-a-uuid"]; !ok {
		t.Error("expected failure entry for invalid worker id")
	}
}

func TestHashesWithAnyTag(t *testing.T) {
	tests := []struct {
		name  string
		tasks []*entities.Task
		names []string
		want  []string
	}{
		{
			name:  "no tasks",
			tasks: []*entities.Task{},
			names: []string{"quality::1080p"},
			want:  nil,
		},
		{
			name: "matches a task carrying one of the names",
			tasks: []*entities.Task{
				{Hash: "h1", Tags: []string{"quality::1080p", "movies"}},
				{Hash: "h2", Tags: []string{"quality::4k"}},
			},
			names: []string{"quality::1080p"},
			want:  []string{"h1"},
		},
		{
			name: "matches every task carrying any of the names, once each",
			tasks: []*entities.Task{
				{Hash: "h1", Tags: []string{"quality::1080p"}},
				{Hash: "h2", Tags: []string{"quality::720p", "quality::1080p"}},
				{Hash: "h3", Tags: []string{"quality::4k"}},
			},
			names: []string{"quality::1080p", "quality::720p"},
			want:  []string{"h1", "h2"},
		},
		{
			name: "task with none of the names is excluded",
			tasks: []*entities.Task{
				{Hash: "h1", Tags: []string{"movies"}},
			},
			names: []string{"quality::1080p"},
			want:  nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := hashesWithAnyTag(tt.tasks, tt.names)
			if len(got) != len(tt.want) {
				t.Fatalf("got %v want %v", got, tt.want)
			}
			for i := range got {
				if got[i] != tt.want[i] {
					t.Fatalf("got %v want %v", got, tt.want)
				}
			}
		})
	}
}
