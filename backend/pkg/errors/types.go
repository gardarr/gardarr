package errors

import "errors"

var (
	ErrTaskNotFound  = errors.New("task not found")
	ErrAgentNotFound = errors.New("agent not found")
)
