package logger

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"
)

func TestNewGormLogger(t *testing.T) {
	tests := []struct {
		name          string
		logLevel      string
		expectedLevel gormlogger.LogLevel
	}{
		{
			name:          "TRACE level enables SQL logging",
			logLevel:      "TRACE",
			expectedLevel: gormlogger.Info,
		},
		{
			name:          "DEBUG level disables SQL logging",
			logLevel:      "DEBUG",
			expectedLevel: gormlogger.Warn,
		},
		{
			name:          "INFO level disables SQL logging",
			logLevel:      "INFO",
			expectedLevel: gormlogger.Warn,
		},
		{
			name:          "WARN level disables SQL logging",
			logLevel:      "WARN",
			expectedLevel: gormlogger.Warn,
		},
		{
			name:          "ERROR level disables SQL logging",
			logLevel:      "ERROR",
			expectedLevel: gormlogger.Warn,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			os.Setenv("LOG_LEVEL", tt.logLevel)
			defer os.Unsetenv("LOG_LEVEL")

			// Re-initialize logger
			Logger = New()

			gormLog := NewGormLogger()

			assert.NotNil(t, gormLog)
			assert.Equal(t, tt.expectedLevel, gormLog.LogLevel)
			assert.Equal(t, time.Second, gormLog.SlowThreshold)
			assert.True(t, gormLog.IgnoreRecordNotFoundError)
		})
	}
}

func TestGormLogger_LogMode(t *testing.T) {
	os.Setenv("LOG_LEVEL", "INFO")
	defer os.Unsetenv("LOG_LEVEL")

	Logger = New()
	gormLog := NewGormLogger()

	// Change log mode
	newLogger := gormLog.LogMode(gormlogger.Info)

	assert.NotNil(t, newLogger)
	assert.IsType(t, &GormLogger{}, newLogger)
	assert.Equal(t, gormlogger.Info, newLogger.(*GormLogger).LogLevel)
}

func TestGormLogger_Info(t *testing.T) {
	os.Setenv("LOG_LEVEL", "TRACE")
	defer os.Unsetenv("LOG_LEVEL")

	Logger = New()
	gormLog := NewGormLogger()

	ctx := context.Background()

	// Should not panic
	assert.NotPanics(t, func() {
		gormLog.Info(ctx, "test info message: %s", "value")
	})
}

func TestGormLogger_Warn(t *testing.T) {
	os.Setenv("LOG_LEVEL", "TRACE")
	defer os.Unsetenv("LOG_LEVEL")

	Logger = New()
	gormLog := NewGormLogger()

	ctx := context.Background()

	// Should not panic
	assert.NotPanics(t, func() {
		gormLog.Warn(ctx, "test warning message: %s", "value")
	})
}

func TestGormLogger_Error(t *testing.T) {
	os.Setenv("LOG_LEVEL", "TRACE")
	defer os.Unsetenv("LOG_LEVEL")

	Logger = New()
	gormLog := NewGormLogger()

	ctx := context.Background()

	// Should not panic
	assert.NotPanics(t, func() {
		gormLog.Error(ctx, "test error message: %s", "value")
	})
}

func TestGormLogger_Trace(t *testing.T) {
	tests := []struct {
		name      string
		logLevel  string
		err       error
		elapsed   time.Duration
		threshold time.Duration
	}{
		{
			name:      "TRACE level logs SQL queries",
			logLevel:  "TRACE",
			err:       nil,
			elapsed:   100 * time.Millisecond,
			threshold: time.Second,
		},
		{
			name:      "ERROR logs database errors",
			logLevel:  "INFO",
			err:       errors.New("database error"),
			elapsed:   100 * time.Millisecond,
			threshold: time.Second,
		},
		{
			name:      "WARN logs slow queries",
			logLevel:  "INFO",
			err:       nil,
			elapsed:   2 * time.Second,
			threshold: time.Second,
		},
		{
			name:      "Ignores RecordNotFound error",
			logLevel:  "INFO",
			err:       gorm.ErrRecordNotFound,
			elapsed:   100 * time.Millisecond,
			threshold: time.Second,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			os.Setenv("LOG_LEVEL", tt.logLevel)
			defer os.Unsetenv("LOG_LEVEL")

			Logger = New()
			gormLog := NewGormLogger()
			gormLog.SlowThreshold = tt.threshold

			ctx := context.Background()
			begin := time.Now().Add(-tt.elapsed)

			fc := func() (string, int64) {
				return "SELECT * FROM users WHERE id = 1", 1
			}

			// Should not panic
			assert.NotPanics(t, func() {
				gormLog.Trace(ctx, begin, fc, tt.err)
			})
		})
	}
}

func TestGormLogger_TraceSilent(t *testing.T) {
	os.Setenv("LOG_LEVEL", "INFO")
	defer os.Unsetenv("LOG_LEVEL")

	Logger = New()
	gormLog := NewGormLogger()
	gormLog = gormLog.LogMode(gormlogger.Silent).(*GormLogger)

	ctx := context.Background()
	begin := time.Now()

	fc := func() (string, int64) {
		return "SELECT * FROM users WHERE id = 1", 1
	}

	// Should not panic and should not log anything
	assert.NotPanics(t, func() {
		gormLog.Trace(ctx, begin, fc, nil)
	})
}

