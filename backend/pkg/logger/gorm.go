package logger

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"
)

// GormLogger is a custom GORM logger that integrates with slog
type GormLogger struct {
	logger                    *slog.Logger
	SlowThreshold             time.Duration
	IgnoreRecordNotFoundError bool
	LogLevel                  gormlogger.LogLevel
}

// NewGormLogger creates a new GORM logger that uses our structured logger
// It automatically sets the log level based on LOG_LEVEL environment variable:
// - TRACE: Shows all SQL queries (Info level for GORM)
// - DEBUG and above: Only shows errors and slow queries (Warn level for GORM)
func NewGormLogger() *GormLogger {
	logLevel := GetLogLevel()

	// Only show SQL queries when in TRACE mode
	gormLevel := gormlogger.Warn
	if logLevel == LevelTrace {
		gormLevel = gormlogger.Info
	}

	return &GormLogger{
		logger:                    Logger.With("component", "gorm"),
		SlowThreshold:             time.Second,
		IgnoreRecordNotFoundError: true,
		LogLevel:                  gormLevel,
	}
}

// LogMode sets the log level
func (l *GormLogger) LogMode(level gormlogger.LogLevel) gormlogger.Interface {
	newLogger := *l
	newLogger.LogLevel = level
	return &newLogger
}

// Info logs info messages
func (l *GormLogger) Info(ctx context.Context, msg string, data ...interface{}) {
	if l.LogLevel >= gormlogger.Info {
		l.logger.InfoContext(ctx, fmt.Sprintf(msg, data...))
	}
}

// Warn logs warning messages
func (l *GormLogger) Warn(ctx context.Context, msg string, data ...interface{}) {
	if l.LogLevel >= gormlogger.Warn {
		l.logger.WarnContext(ctx, fmt.Sprintf(msg, data...))
	}
}

// Error logs error messages
func (l *GormLogger) Error(ctx context.Context, msg string, data ...interface{}) {
	if l.LogLevel >= gormlogger.Error {
		l.logger.ErrorContext(ctx, fmt.Sprintf(msg, data...))
	}
}

// Trace logs SQL queries and execution details
func (l *GormLogger) Trace(ctx context.Context, begin time.Time, fc func() (sql string, rowsAffected int64), err error) {
	if l.LogLevel <= gormlogger.Silent {
		return
	}

	elapsed := time.Since(begin)
	sql, rows := fc()

	switch {
	case err != nil && l.LogLevel >= gormlogger.Error && (!errors.Is(err, gorm.ErrRecordNotFound) || !l.IgnoreRecordNotFoundError):
		// Log errors
		l.logger.ErrorContext(ctx, "Database error",
			"error", err,
			"elapsed", elapsed,
			"rows", rows,
			"sql", sql,
		)
	case elapsed > l.SlowThreshold && l.SlowThreshold != 0 && l.LogLevel >= gormlogger.Warn:
		// Log slow queries
		l.logger.WarnContext(ctx, "Slow SQL query detected",
			"elapsed", elapsed,
			"threshold", l.SlowThreshold,
			"rows", rows,
			"sql", sql,
		)
	case l.LogLevel == gormlogger.Info:
		// Log all queries (only in TRACE mode)
		l.logger.Log(ctx, LevelTrace, "SQL query executed",
			"elapsed", elapsed,
			"rows", rows,
			"sql", sql,
		)
	}
}
