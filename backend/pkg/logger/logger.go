package logger

import (
	"context"
	"log/slog"
	"os"
	"strings"

	"github.com/jfxdev/gardarr/pkg/env"
)

// Custom log level for TRACE (more verbose than DEBUG)
const LevelTrace = slog.Level(-8)

// Logger is the global logger instance
var Logger *slog.Logger

// init initializes the logger on package import
func init() {
	Logger = New()
}

// New creates a new logger with the configured level from environment
func New() *slog.Logger {
	level := getLogLevel()

	handler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: level,
		ReplaceAttr: func(groups []string, a slog.Attr) slog.Attr {
			if a.Key == slog.LevelKey {
				level := a.Value.Any().(slog.Level)
				if level == LevelTrace {
					a.Value = slog.StringValue("TRACE")
				}
			}
			return a
		},
	})

	return slog.New(handler)
}

// getLogLevel retrieves and parses the log level from environment
// Defaults to Info if not set or invalid
func getLogLevel() slog.Level {
	levelStr := strings.ToUpper(env.Get("LOG_LEVEL").Default("INFO").Value())

	switch levelStr {
	case "TRACE":
		return LevelTrace
	case "DEBUG":
		return slog.LevelDebug
	case "INFO":
		return slog.LevelInfo
	case "WARN", "WARNING":
		return slog.LevelWarn
	case "ERROR":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}

// GetLogLevel returns the current log level
func GetLogLevel() slog.Level {
	return getLogLevel()
}

// SetDefault sets the logger as the default slog logger
func SetDefault() {
	slog.SetDefault(Logger)
}

// Trace logs a trace message (more verbose than debug)
func Trace(msg string, args ...any) {
	Logger.Log(context.Background(), LevelTrace, msg, args...)
}

// Debug logs a debug message
func Debug(msg string, args ...any) {
	Logger.Debug(msg, args...)
}

// Info logs an info message
func Info(msg string, args ...any) {
	Logger.Info(msg, args...)
}

// Warn logs a warning message
func Warn(msg string, args ...any) {
	Logger.Warn(msg, args...)
}

// Error logs an error message
func Error(msg string, args ...any) {
	Logger.Error(msg, args...)
}

// With creates a new logger with the given attributes
func With(args ...any) *slog.Logger {
	return Logger.With(args...)
}
