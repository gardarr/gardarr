package errors

import (
	"errors"
	"net/http"
)

var (
	ErrTaskNotFound     = errors.New("task not found")
	ErrAgentNotFound    = errors.New("agent not found")
	ErrInvalidUUID      = errors.New("invalid UUID format")
	ErrInvalidInput     = errors.New("invalid input data")
	ErrAgentUnavailable = errors.New("agent unavailable")
)

// ResponseError represents an HTTP error response with status code and message
type ResponseError struct {
	StatusCode int    `json:"status_code"`
	Message    string `json:"message"`
	Error      string `json:"error,omitempty"`
}

// NewResponseError creates a new ResponseError
func NewResponseError(statusCode int, message string, err error) *ResponseError {
	re := &ResponseError{
		StatusCode: statusCode,
		Message:    message,
	}
	if err != nil {
		re.Error = err.Error()
	}
	return re
}

// NewBadRequestError creates a 400 Bad Request error
func NewBadRequestError(message string, err error) *ResponseError {
	return NewResponseError(http.StatusBadRequest, message, err)
}

// NewNotFoundError creates a 404 Not Found error
func NewNotFoundError(message string, err error) *ResponseError {
	return NewResponseError(http.StatusNotFound, message, err)
}

// NewInternalServerError creates a 500 Internal Server Error
func NewInternalServerError(message string, err error) *ResponseError {
	return NewResponseError(http.StatusInternalServerError, message, err)
}

// NewServiceUnavailableError creates a 503 Service Unavailable error
func NewServiceUnavailableError(message string, err error) *ResponseError {
	return NewResponseError(http.StatusServiceUnavailable, message, err)
}

// ToResponseError converts a standard error to a ResponseError
// It intelligently detects error types based on error messages
func ToResponseError(err error) *ResponseError {
	if err == nil {
		return nil
	}

	errMsg := err.Error()

	// Check for predefined error types
	switch {
	case errors.Is(err, ErrTaskNotFound):
		return NewNotFoundError("Task not found", err)
	case errors.Is(err, ErrAgentNotFound):
		return NewNotFoundError("Agent not found", err)
	case errors.Is(err, ErrInvalidUUID):
		return NewBadRequestError("Invalid ID format", err)
	case errors.Is(err, ErrInvalidInput):
		return NewBadRequestError("Invalid request", err)
	case errors.Is(err, ErrAgentUnavailable):
		return NewServiceUnavailableError("Agent is unavailable", err)
	}

	// Check error message patterns for wrapped errors
	switch {
	case contains(errMsg, "invalid UUID format"):
		return NewBadRequestError("Invalid ID format", err)
	case contains(errMsg, "agent not found"):
		return NewNotFoundError("Agent not found", err)
	case contains(errMsg, "task not found"):
		return NewNotFoundError("Task not found", err)
	case contains(errMsg, "failed to create task"):
		return NewServiceUnavailableError("Unable to create task on agent", err)
	case contains(errMsg, "errors occurred while fetching tasks"):
		return NewServiceUnavailableError("Unable to fetch tasks from agents", err)
	default:
		return NewInternalServerError("An unexpected error occurred", err)
	}
}

// contains is a helper function to check if a string contains a substring (case-insensitive)
func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > len(substr) &&
		(s[:len(substr)] == substr || s[len(s)-len(substr):] == substr ||
			findSubstring(s, substr)))
}

func findSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
