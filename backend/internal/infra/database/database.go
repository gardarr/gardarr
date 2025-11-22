package database

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/jfxdev/gardarr/internal/constants"
	"github.com/jfxdev/gardarr/pkg/env"
	"gorm.io/driver/postgres"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Database holds the database connection and configuration
type Database struct {
	DB     *gorm.DB
	driver string
}

// Config holds database configuration parameters
type Config struct {
	driver   string // "postgres" or "sqlite"
	host     string
	port     string
	user     string
	password string
	dbName   string
	sslMode  string
	filePath string // for SQLite
}

// NewDatabase creates a new database connection based on the provided configuration
func NewDatabase() (*Database, error) {
	var db *gorm.DB
	var err error

	config := loadConfigFromEnv()

	// Configure GORM logger based on environment
	logLevel := logger.Info
	if level := strings.ToLower(env.Get("DATABASE_LOG_LEVEL").Value()); level != "" {
		switch level {
		case "silent":
			logLevel = logger.Silent
		case "error":
			logLevel = logger.Error
		case "warn":
			logLevel = logger.Warn
		case "info":
			logLevel = logger.Info
		}
	}

	gormLogger := logger.New(
		log.New(os.Stdout, "\r\n", log.LstdFlags),
		logger.Config{
			SlowThreshold:             time.Second,
			LogLevel:                  logLevel,
			IgnoreRecordNotFoundError: true,
			Colorful:                  false,
		},
	)

	// Connect based on driver type
	switch config.driver {
	case "postgres", "postgresql":
		dsn := fmt.Sprintf(
			"host=%s user=%s password=%s dbname=%s port=%s sslmode=%s",
			config.host, config.user, config.password, config.dbName, config.port, config.sslMode,
		)
		db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{
			Logger: gormLogger,
		})
	case constants.DatabaseDriverSQLite:
		// Ensure SQLite database file and directory exist
		if err := ensureSQLiteFile(config.filePath); err != nil {
			return nil, fmt.Errorf("failed to create SQLite database file: %w", err)
		}

		db, err = gorm.Open(sqlite.Open(config.filePath), &gorm.Config{
			Logger: gormLogger,
		})
	default:
		return nil, fmt.Errorf("unsupported database driver: %s", config.driver)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	// Configure connection pool for PostgreSQL
	if config.driver == "postgres" || config.driver == "postgresql" {
		sqlDB, err := db.DB()
		if err != nil {
			return nil, fmt.Errorf("failed to get underlying sql.DB: %w", err)
		}

		// Set connection pool settings from environment or use defaults
		maxIdleConns := env.Get("DATABASE_MAX_IDLE_CONNS").Default(10).ValueInt()
		maxOpenConns := env.Get("DATABASE_MAX_OPEN_CONNS").Default(100).ValueInt()
		connMaxLifetime := env.Get("DATABASE_CONN_MAX_LIFETIME").Default("1h").ValueDuration()

		sqlDB.SetMaxIdleConns(maxIdleConns)
		sqlDB.SetMaxOpenConns(maxOpenConns)
		sqlDB.SetConnMaxLifetime(connMaxLifetime)
	}

	return &Database{DB: db, driver: config.driver}, nil
}

// ensureSQLiteFile ensures that the SQLite database file and its directory exist.
// If the file doesn't exist, it creates an empty file. If the directory doesn't exist, it creates it.
func ensureSQLiteFile(filePath string) error {
	// Get the absolute path
	absPath, err := filepath.Abs(filePath)
	if err != nil {
		return fmt.Errorf("failed to get absolute path: %w", err)
	}

	// Extract directory from file path
	dir := filepath.Dir(absPath)

	// Create directory if it doesn't exist
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create database directory: %w", err)
	}

	// Check if file already exists
	if _, err := os.Stat(absPath); os.IsNotExist(err) {
		// Create an empty file
		file, err := os.Create(absPath)
		if err != nil {
			return fmt.Errorf("failed to create database file: %w", err)
		}
		if err := file.Close(); err != nil {
			return fmt.Errorf("failed to close database file: %w", err)
		}
		// Set appropriate permissions (read/write for owner, read for group and others)
		if err := os.Chmod(absPath, 0644); err != nil {
			return fmt.Errorf("failed to set database file permissions: %w", err)
		}
	}

	return nil
}

// Ping checks if the database connection is alive and responsive
func (d *Database) Ping(ctx context.Context) error {
	// Get underlying sql.DB
	sqlDB, err := d.DB.DB()
	if err != nil {
		return fmt.Errorf("failed to get underlying sql.DB: %w", err)
	}

	// Create context with timeout for ping operation
	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	// Ping the database
	if err := sqlDB.PingContext(pingCtx); err != nil {
		return fmt.Errorf("database ping failed: %w", err)
	}

	return nil
}

// Close gracefully closes the database connection
func (d *Database) Close() error {
	sqlDB, err := d.DB.DB()
	if err != nil {
		return fmt.Errorf("failed to get underlying sql.DB: %w", err)
	}

	if err := sqlDB.Close(); err != nil {
		return fmt.Errorf("failed to close database connection: %w", err)
	}

	return nil
}

// GetStats returns database connection statistics
// Note: Connection pool stats are only meaningful for PostgreSQL
func (d *Database) GetStats() (map[string]any, error) {
	// SQLite doesn't support meaningful connection pool statistics
	if d.driver == constants.DatabaseDriverSQLite {
		return map[string]any{
			"driver":               constants.DatabaseDriverSQLite,
			"connection_pooling":   false,
			"max_open_connections": 1,
			"open_connections":     1,
			"in_use":               0,
			"idle":                 0,
			"note":                 "SQLite uses single connection, pool stats not applicable",
		}, nil
	}

	// PostgreSQL connection pool statistics
	sqlDB, err := d.DB.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to get underlying sql.DB: %w", err)
	}

	stats := sqlDB.Stats()

	return map[string]any{
		"driver":               d.driver,
		"connection_pooling":   true,
		"max_open_connections": stats.MaxOpenConnections,
		"open_connections":     stats.OpenConnections,
		"in_use":               stats.InUse,
		"idle":                 stats.Idle,
		"wait_count":           stats.WaitCount,
		"wait_duration":        stats.WaitDuration.String(),
		"max_idle_closed":      stats.MaxIdleClosed,
		"max_idle_time_closed": stats.MaxIdleTimeClosed,
		"max_lifetime_closed":  stats.MaxLifetimeClosed,
	}, nil
}
