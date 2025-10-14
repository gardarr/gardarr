package errors

import (
	"errors"
	"net/http"
	"testing"
)

func TestNewResponseError(t *testing.T) {
	err := errors.New("test error")
	respErr := NewResponseError(http.StatusBadRequest, "Bad request", err)

	if respErr.StatusCode != http.StatusBadRequest {
		t.Errorf("Expected status code %d, got %d", http.StatusBadRequest, respErr.StatusCode)
	}

	if respErr.Message != "Bad request" {
		t.Errorf("Expected message 'Bad request', got '%s'", respErr.Message)
	}

	if respErr.Error != "test error" {
		t.Errorf("Expected error 'test error', got '%s'", respErr.Error)
	}
}

func TestNewResponseErrorWithoutError(t *testing.T) {
	respErr := NewResponseError(http.StatusBadRequest, "Bad request", nil)

	if respErr.StatusCode != http.StatusBadRequest {
		t.Errorf("Expected status code %d, got %d", http.StatusBadRequest, respErr.StatusCode)
	}

	if respErr.Message != "Bad request" {
		t.Errorf("Expected message 'Bad request', got '%s'", respErr.Message)
	}

	if respErr.Error != "" {
		t.Errorf("Expected empty error, got '%s'", respErr.Error)
	}
}

func TestNewBadRequestError(t *testing.T) {
	err := errors.New("validation failed")
	respErr := NewBadRequestError("Invalid input", err)

	if respErr.StatusCode != http.StatusBadRequest {
		t.Errorf("Expected status code %d, got %d", http.StatusBadRequest, respErr.StatusCode)
	}

	if respErr.Message != "Invalid input" {
		t.Errorf("Expected message 'Invalid input', got '%s'", respErr.Message)
	}

	if respErr.Error != "validation failed" {
		t.Errorf("Expected error 'validation failed', got '%s'", respErr.Error)
	}
}

func TestNewNotFoundError(t *testing.T) {
	err := errors.New("resource not found")
	respErr := NewNotFoundError("Not found", err)

	if respErr.StatusCode != http.StatusNotFound {
		t.Errorf("Expected status code %d, got %d", http.StatusNotFound, respErr.StatusCode)
	}

	if respErr.Message != "Not found" {
		t.Errorf("Expected message 'Not found', got '%s'", respErr.Message)
	}
}

func TestNewInternalServerError(t *testing.T) {
	err := errors.New("internal error")
	respErr := NewInternalServerError("Server error", err)

	if respErr.StatusCode != http.StatusInternalServerError {
		t.Errorf("Expected status code %d, got %d", http.StatusInternalServerError, respErr.StatusCode)
	}

	if respErr.Message != "Server error" {
		t.Errorf("Expected message 'Server error', got '%s'", respErr.Message)
	}
}

func TestNewServiceUnavailableError(t *testing.T) {
	err := errors.New("service down")
	respErr := NewServiceUnavailableError("Service unavailable", err)

	if respErr.StatusCode != http.StatusServiceUnavailable {
		t.Errorf("Expected status code %d, got %d", http.StatusServiceUnavailable, respErr.StatusCode)
	}

	if respErr.Message != "Service unavailable" {
		t.Errorf("Expected message 'Service unavailable', got '%s'", respErr.Message)
	}
}

func TestToResponseError_TaskNotFound(t *testing.T) {
	respErr := ToResponseError(ErrTaskNotFound)

	if respErr.StatusCode != http.StatusNotFound {
		t.Errorf("Expected status code %d, got %d", http.StatusNotFound, respErr.StatusCode)
	}

	if respErr.Message != "Resource not found" {
		t.Errorf("Expected message 'Resource not found', got '%s'", respErr.Message)
	}
}

func TestToResponseError_AgentNotFound(t *testing.T) {
	respErr := ToResponseError(ErrAgentNotFound)

	if respErr.StatusCode != http.StatusNotFound {
		t.Errorf("Expected status code %d, got %d", http.StatusNotFound, respErr.StatusCode)
	}

	if respErr.Message != "Resource not found" {
		t.Errorf("Expected message 'Resource not found', got '%s'", respErr.Message)
	}
}

func TestToResponseError_InvalidUUID(t *testing.T) {
	respErr := ToResponseError(ErrInvalidUUID)

	if respErr.StatusCode != http.StatusBadRequest {
		t.Errorf("Expected status code %d, got %d", http.StatusBadRequest, respErr.StatusCode)
	}

	if respErr.Message != "Invalid request" {
		t.Errorf("Expected message 'Invalid request', got '%s'", respErr.Message)
	}
}

func TestToResponseError_InvalidInput(t *testing.T) {
	respErr := ToResponseError(ErrInvalidInput)

	if respErr.StatusCode != http.StatusBadRequest {
		t.Errorf("Expected status code %d, got %d", http.StatusBadRequest, respErr.StatusCode)
	}

	if respErr.Message != "Invalid request" {
		t.Errorf("Expected message 'Invalid request', got '%s'", respErr.Message)
	}
}

func TestToResponseError_AgentUnavailable(t *testing.T) {
	respErr := ToResponseError(ErrAgentUnavailable)

	if respErr.StatusCode != http.StatusServiceUnavailable {
		t.Errorf("Expected status code %d, got %d", http.StatusServiceUnavailable, respErr.StatusCode)
	}

	if respErr.Message != "Agent is unavailable" {
		t.Errorf("Expected message 'Agent is unavailable', got '%s'", respErr.Message)
	}
}

func TestToResponseError_UnknownError(t *testing.T) {
	unknownErr := errors.New("unknown error")
	respErr := ToResponseError(unknownErr)

	if respErr.StatusCode != http.StatusInternalServerError {
		t.Errorf("Expected status code %d, got %d", http.StatusInternalServerError, respErr.StatusCode)
	}

	if respErr.Message != "An unexpected error occurred" {
		t.Errorf("Expected message 'An unexpected error occurred', got '%s'", respErr.Message)
	}

	if respErr.Error != "unknown error" {
		t.Errorf("Expected error 'unknown error', got '%s'", respErr.Error)
	}
}

func TestToResponseError_NilError(t *testing.T) {
	respErr := ToResponseError(nil)

	if respErr != nil {
		t.Errorf("Expected nil response error, got %v", respErr)
	}
}

func TestToResponseError_WrappedInvalidUUID(t *testing.T) {
	wrappedErr := errors.New("invalid UUID format: some details")
	respErr := ToResponseError(wrappedErr)

	if respErr.StatusCode != http.StatusBadRequest {
		t.Errorf("Expected status code %d, got %d", http.StatusBadRequest, respErr.StatusCode)
	}

	if respErr.Message != "Invalid ID format" {
		t.Errorf("Expected message 'Invalid ID format', got '%s'", respErr.Message)
	}
}

func TestToResponseError_WrappedAgentNotFound(t *testing.T) {
	wrappedErr := errors.New("agent not found: details here")
	respErr := ToResponseError(wrappedErr)

	if respErr.StatusCode != http.StatusNotFound {
		t.Errorf("Expected status code %d, got %d", http.StatusNotFound, respErr.StatusCode)
	}

	if respErr.Message != "Agent not found" {
		t.Errorf("Expected message 'Agent not found', got '%s'", respErr.Message)
	}
}

func TestToResponseError_WrappedTaskNotFound(t *testing.T) {
	wrappedErr := errors.New("task not found in database")
	respErr := ToResponseError(wrappedErr)

	if respErr.StatusCode != http.StatusNotFound {
		t.Errorf("Expected status code %d, got %d", http.StatusNotFound, respErr.StatusCode)
	}

	if respErr.Message != "Task not found" {
		t.Errorf("Expected message 'Task not found', got '%s'", respErr.Message)
	}
}

func TestToResponseError_FailedToCreateTask(t *testing.T) {
	wrappedErr := errors.New("failed to create task: connection refused")
	respErr := ToResponseError(wrappedErr)

	if respErr.StatusCode != http.StatusServiceUnavailable {
		t.Errorf("Expected status code %d, got %d", http.StatusServiceUnavailable, respErr.StatusCode)
	}

	if respErr.Message != "Unable to create task on agent" {
		t.Errorf("Expected message 'Unable to create task on agent', got '%s'", respErr.Message)
	}
}

func TestToResponseError_ErrorsFetchingTasks(t *testing.T) {
	wrappedErr := errors.New("errors occurred while fetching tasks from agents: timeout")
	respErr := ToResponseError(wrappedErr)

	if respErr.StatusCode != http.StatusServiceUnavailable {
		t.Errorf("Expected status code %d, got %d", http.StatusServiceUnavailable, respErr.StatusCode)
	}

	if respErr.Message != "Unable to fetch tasks from agents" {
		t.Errorf("Expected message 'Unable to fetch tasks from agents', got '%s'", respErr.Message)
	}
}
