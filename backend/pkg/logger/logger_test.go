package logger

import (
	"log/slog"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGetLogLevel(t *testing.T) {
	tests := []struct {
		name     string
		envValue string
		expected slog.Level
	}{
		{
			name:     "Trace level",
			envValue: "TRACE",
			expected: LevelTrace,
		},
		{
			name:     "Debug level",
			envValue: "DEBUG",
			expected: slog.LevelDebug,
		},
		{
			name:     "Info level",
			envValue: "INFO",
			expected: slog.LevelInfo,
		},
		{
			name:     "Warn level",
			envValue: "WARN",
			expected: slog.LevelWarn,
		},
		{
			name:     "Warning level (alias)",
			envValue: "WARNING",
			expected: slog.LevelWarn,
		},
		{
			name:     "Error level",
			envValue: "ERROR",
			expected: slog.LevelError,
		},
		{
			name:     "Invalid level defaults to Info",
			envValue: "INVALID",
			expected: slog.LevelInfo,
		},
		{
			name:     "Empty level defaults to Info",
			envValue: "",
			expected: slog.LevelInfo,
		},
		{
			name:     "Case insensitive - lowercase trace",
			envValue: "trace",
			expected: LevelTrace,
		},
		{
			name:     "Case insensitive - lowercase debug",
			envValue: "debug",
			expected: slog.LevelDebug,
		},
		{
			name:     "Case insensitive - mixed case error",
			envValue: "ErRoR",
			expected: slog.LevelError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Set environment variable
			if tt.envValue != "" {
				os.Setenv("LOG_LEVEL", tt.envValue)
			} else {
				os.Unsetenv("LOG_LEVEL")
			}
			
			// Get level
			level := getLogLevel()
			
			// Assert
			assert.Equal(t, tt.expected, level)
		})
	}

	// Cleanup
	os.Unsetenv("LOG_LEVEL")
}

func TestNew(t *testing.T) {
	// Set log level to debug
	os.Setenv("LOG_LEVEL", "DEBUG")
	defer os.Unsetenv("LOG_LEVEL")

	logger := New()

	assert.NotNil(t, logger)
	assert.IsType(t, &slog.Logger{}, logger)
}

func TestLoggerFunctions(t *testing.T) {
	// Set log level to trace to ensure all messages are logged
	os.Setenv("LOG_LEVEL", "TRACE")
	defer os.Unsetenv("LOG_LEVEL")

	// Re-initialize logger
	Logger = New()

	// Test that these don't panic
	assert.NotPanics(t, func() {
		Trace("trace message", "key", "value")
	})

	assert.NotPanics(t, func() {
		Debug("debug message", "key", "value")
	})

	assert.NotPanics(t, func() {
		Info("info message", "key", "value")
	})

	assert.NotPanics(t, func() {
		Warn("warning message", "key", "value")
	})

	assert.NotPanics(t, func() {
		Error("error message", "key", "value")
	})
}

func TestWith(t *testing.T) {
	// Set log level to debug
	os.Setenv("LOG_LEVEL", "DEBUG")
	defer os.Unsetenv("LOG_LEVEL")

	// Re-initialize logger
	Logger = New()

	// Create logger with attributes
	childLogger := With("component", "test", "version", "1.0")

	assert.NotNil(t, childLogger)
	assert.IsType(t, &slog.Logger{}, childLogger)

	// Test that logging doesn't panic
	assert.NotPanics(t, func() {
		childLogger.Info("test message with context")
	})
}

func TestSetDefault(t *testing.T) {
	// Set log level
	os.Setenv("LOG_LEVEL", "INFO")
	defer os.Unsetenv("LOG_LEVEL")

	// Re-initialize logger
	Logger = New()

	// Set as default
	assert.NotPanics(t, func() {
		SetDefault()
	})

	// Test that default logger works
	assert.NotPanics(t, func() {
		slog.Info("test message using default logger")
	})
}

