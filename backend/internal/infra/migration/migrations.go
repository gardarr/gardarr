package migration

import (
	"database/sql"
	"fmt"
	"sort"
	"strings"
	"time"

	"gorm.io/gorm"
)

// Migration represents a single database migration
type Migration struct {
	ID          uint      `gorm:"primaryKey"`
	Version     string    `gorm:"uniqueIndex;not null;size:255"`
	Description string    `gorm:"size:500"`
	AppliedAt   time.Time `gorm:"not null"`
	Checksum    string    `gorm:"size:64"`
	ErrorMsg    string    `gorm:"size:1000"`
	Status      string    `gorm:"size:50;default:'completed'"` // Fixed: default to 'completed' for successful migrations
	Attempts    int       `gorm:"default:0"`
	StartedAt   time.Time `gorm:"default:null"`
}

// MigrationFunc defines the signature for migration functions
type MigrationFunc func(db *gorm.DB) error

// MigrationItem holds migration metadata and functions
type MigrationItem struct {
	Version     string        // e.g., "001_create_users_table"
	Description string        // Human-readable description
	Up          MigrationFunc // Forward migration
	Down        MigrationFunc // Rollback migration (optional)
}

// Migrator handles database migrations
type Migrator struct {
	db         *gorm.DB
	migrations []MigrationItem
	tableName  string
	instanceID string
}

// NewMigrator creates a new migration manager
func NewMigrator(db *gorm.DB) *Migrator {
	return &Migrator{
		db:         db,
		migrations: make([]MigrationItem, 0),
		tableName:  "migrations",
		instanceID: fmt.Sprintf("migration_instance_%d", time.Now().UnixNano()),
	}
}

// SetTableName allows customizing the migrations table name
func (m *Migrator) SetTableName(name string) *Migrator {
	m.tableName = name
	return m
}

// Register adds a migration to the list
func (m *Migrator) Register(migration MigrationItem) *Migrator {
	m.migrations = append(m.migrations, migration)
	return m
}

// RegisterMultiple adds multiple migrations at once
func (m *Migrator) RegisterMultiple(migrations []MigrationItem) *Migrator {
	m.migrations = append(m.migrations, migrations...)
	return m
}

// createMigrationsTable creates the migrations tracking table if it doesn't exist
func (m *Migrator) createMigrationsTable() error {
	// Set custom table name if specified
	if m.tableName != "migrations" {
		m.db.Table(m.tableName).AutoMigrate(&Migration{})
	} else {
		if err := m.db.AutoMigrate(&Migration{}); err != nil {
			return fmt.Errorf("failed to create migrations table: %w", err)
		}
	}
	return nil
}

// getAppliedMigrations returns list of already applied migration versions
func (m *Migrator) getAppliedMigrations() (map[string]bool, error) {
	var applied []Migration
	var appliedMap = make(map[string]bool)

	// Only consider completed migrations as applied
	result := m.db.Table(m.tableName).Where("status = ?", "completed").Find(&applied)
	if result.Error != nil {
		return nil, fmt.Errorf("failed to fetch applied migrations: %w", result.Error)
	}

	for _, migration := range applied {
		appliedMap[migration.Version] = true
	}

	return appliedMap, nil
}

// calculateChecksum generates a simple checksum for migration integrity
func (m *Migrator) calculateChecksum(version, description string) string {
	return fmt.Sprintf("%x", []byte(version+description))
}

// Up runs all pending migrations with concurrency protection
func (m *Migrator) Up() error {
	if err := m.createMigrationsTable(); err != nil {
		return err
	}

	// Try to acquire migration lock
	if err := m.acquireLock(); err != nil {
		fmt.Printf("Migration lock held by another instance: %v\n", err)
		fmt.Println("Waiting for other instance to complete migrations...")

		// Wait for lock to be released
		if err := m.waitForLock(); err != nil {
			return err
		}

		fmt.Println("Migration lock released, checking if migrations are needed...")
	} else {
		// We got the lock, ensure we release it
		defer func() {
			if err := m.releaseLock(); err != nil {
				fmt.Printf("Warning: failed to release migration lock: %v\n", err)
			}
		}()
	}

	// Sort migrations by version
	sort.Slice(m.migrations, func(i, j int) bool {
		return m.migrations[i].Version < m.migrations[j].Version
	})

	// Get already applied migrations (re-check after acquiring lock)
	applied, err := m.getAppliedMigrations()
	if err != nil {
		return err
	}

	pendingCount := 0
	for _, migration := range m.migrations {
		if !applied[migration.Version] {
			pendingCount++
		}
	}

	if pendingCount == 0 {
		fmt.Println("No pending migrations found")
		return nil
	}

	fmt.Printf("Found %d pending migrations\n", pendingCount)

	// Run pending migrations
	for _, migration := range m.migrations {
		if applied[migration.Version] {
			continue // Skip already applied
		}

		fmt.Printf("Applying migration: %s - %s\n", migration.Version, migration.Description)

		// Start transaction with proper isolation
		tx := m.db.Begin(&sql.TxOptions{
			Isolation: sql.LevelSerializable, // Highest isolation level
		})
		if tx.Error != nil {
			return fmt.Errorf("failed to start transaction for migration %s: %w", migration.Version, tx.Error)
		}

		// Double-check migration wasn't applied by another instance
		var existingCount int64
		tx.Table(m.tableName).Where("version = ? AND status = ?", migration.Version, "completed").Count(&existingCount)
		if existingCount > 0 {
			tx.Rollback()
			fmt.Printf("Migration %s was applied by another instance, skipping\n", migration.Version)
			continue
		}

		// Create migration record with running status first
		migrationRecord := Migration{
			Version:     migration.Version,
			Description: migration.Description,
			AppliedAt:   time.Now(),
			StartedAt:   time.Now(),
			Checksum:    m.calculateChecksum(migration.Version, migration.Description),
			Status:      "running",
			Attempts:    1,
		}

		if err := tx.Table(m.tableName).Create(&migrationRecord).Error; err != nil {
			tx.Rollback()
			return fmt.Errorf("failed to record migration start %s: %w", migration.Version, err)
		}

		// Run migration
		if err := migration.Up(tx); err != nil {
			// Update status to failed
			tx.Table(m.tableName).Where("version = ?", migration.Version).Updates(Migration{
				Status:   "failed",
				ErrorMsg: err.Error(),
			})
			tx.Rollback()
			return fmt.Errorf("migration %s failed: %w", migration.Version, err)
		}

		// Update status to completed
		if err := tx.Table(m.tableName).Where("version = ?", migration.Version).Updates(Migration{
			Status:    "completed",
			AppliedAt: time.Now(),
			ErrorMsg:  "",
		}).Error; err != nil {
			tx.Rollback()
			return fmt.Errorf("failed to update migration status %s: %w", migration.Version, err)
		}

		// Commit transaction
		if err := tx.Commit().Error; err != nil {
			return fmt.Errorf("failed to commit migration %s: %w", migration.Version, err)
		}

		fmt.Printf("Migration completed: %s\n", migration.Version)
	}

	fmt.Println("All migrations completed successfully")
	return nil
}

// Down rolls back the last applied migration
func (m *Migrator) Down() error {
	if err := m.createMigrationsTable(); err != nil {
		return err
	}

	// Get the last applied migration
	var lastMigration Migration
	result := m.db.Table(m.tableName).Where("status = ?", "completed").Order("applied_at desc").First(&lastMigration)
	if result.Error != nil {
		return fmt.Errorf("no migrations to rollback: %w", result.Error)
	}

	// Find the migration item
	var migrationItem *MigrationItem
	for _, migration := range m.migrations {
		if migration.Version == lastMigration.Version {
			migrationItem = &migration
			break
		}
	}

	if migrationItem == nil {
		return fmt.Errorf("migration %s not found in registered migrations", lastMigration.Version)
	}

	if migrationItem.Down == nil {
		return fmt.Errorf("migration %s has no rollback function", lastMigration.Version)
	}

	fmt.Printf("Rolling back migration: %s - %s\n", migrationItem.Version, migrationItem.Description)

	// Start transaction
	tx := m.db.Begin()
	if tx.Error != nil {
		return fmt.Errorf("failed to start transaction for rollback %s: %w", migrationItem.Version, tx.Error)
	}

	// Run rollback
	if err := migrationItem.Down(tx); err != nil {
		tx.Rollback()
		return fmt.Errorf("rollback %s failed: %w", migrationItem.Version, err)
	}

	// Remove migration record
	if err := tx.Table(m.tableName).Where("version = ?", lastMigration.Version).Delete(&Migration{}).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to remove migration record %s: %w", migrationItem.Version, err)
	}

	// Commit transaction
	if err := tx.Commit().Error; err != nil {
		return fmt.Errorf("failed to commit rollback %s: %w", migrationItem.Version, err)
	}

	fmt.Printf("Rollback completed: %s\n", migrationItem.Version)
	return nil
}

// Status shows the current migration status with error details
func (m *Migrator) Status() error {
	if err := m.createMigrationsTable(); err != nil {
		return err
	}

	// Get all migration records
	var allRecords []Migration
	m.db.Table(m.tableName).Order("version").Find(&allRecords)

	// Create map for quick lookup
	recordMap := make(map[string]Migration)
	for _, record := range allRecords {
		recordMap[record.Version] = record
	}

	// Sort migrations by version
	sort.Slice(m.migrations, func(i, j int) bool {
		return m.migrations[i].Version < m.migrations[j].Version
	})

	fmt.Println("Migration Status:")
	fmt.Println("=================")
	fmt.Printf("%-30s %-15s %-10s %-20s %s\n", "VERSION", "STATUS", "ATTEMPTS", "APPLIED_AT", "ERROR")
	fmt.Println(strings.Repeat("-", 100))

	for _, migration := range m.migrations {
		if record, exists := recordMap[migration.Version]; exists {
			appliedAt := record.AppliedAt.Format("2006-01-02 15:04:05")
			errorMsg := record.ErrorMsg
			if len(errorMsg) > 50 {
				errorMsg = errorMsg[:47] + "..."
			}
			fmt.Printf("%-30s %-15s %-10d %-20s %s\n",
				migration.Version, record.Status, record.Attempts, appliedAt, errorMsg)
		} else {
			fmt.Printf("%-30s %-15s %-10s %-20s %s\n",
				migration.Version, "PENDING", "-", "-", "")
		}
	}

	// Show summary
	completed := 0
	failed := 0
	running := 0
	pending := 0

	for _, migration := range m.migrations {
		if record, exists := recordMap[migration.Version]; exists {
			switch record.Status {
			case "completed":
				completed++
			case "failed":
				failed++
			case "running":
				running++
			}
		} else {
			pending++
		}
	}

	fmt.Println(strings.Repeat("-", 100))
	fmt.Printf("Summary: %d completed, %d failed, %d running, %d pending\n", completed, failed, running, pending)

	return nil
}

// Reset removes all migration records (dangerous - use with caution)
func (m *Migrator) Reset() error {
	if err := m.createMigrationsTable(); err != nil {
		return err
	}

	result := m.db.Table(m.tableName).Where("1 = 1").Delete(&Migration{})
	if result.Error != nil {
		return fmt.Errorf("failed to reset migrations: %w", result.Error)
	}

	fmt.Printf("Reset completed. Removed %d migration records\n", result.RowsAffected)
	return nil
}

// MigrationLock represents the migration lock table for concurrency control
type MigrationLock struct {
	ID        uint      `gorm:"primaryKey"`
	LockedAt  time.Time `gorm:"not null"`
	LockedBy  string    `gorm:"size:255;not null"` // Instance identifier
	ExpiresAt time.Time `gorm:"not null"`
}

// acquireLock attempts to acquire a migration lock with timeout
func (m *Migrator) acquireLock() error {
	// Create lock table if it doesn't exist
	if err := m.db.AutoMigrate(&MigrationLock{}); err != nil {
		return fmt.Errorf("failed to create migration lock table: %w", err)
	}

	lockExpiry := time.Now().Add(30 * time.Minute) // Lock expires in 30 minutes
	now := time.Now()

	// Clean up expired locks first
	m.db.Where("expires_at < ?", now).Delete(&MigrationLock{})

	// Try to acquire lock
	lock := MigrationLock{
		LockedAt:  now,
		LockedBy:  m.instanceID,
		ExpiresAt: lockExpiry,
	}

	// Use a transaction to ensure atomicity
	tx := m.db.Begin()
	if tx.Error != nil {
		return fmt.Errorf("failed to start lock transaction: %w", tx.Error)
	}

	// Check if lock exists
	var existingLock MigrationLock
	result := tx.First(&existingLock)

	if result.Error == nil {
		// Lock exists and is not expired
		tx.Rollback()
		return fmt.Errorf("migration lock held by instance: %s", existingLock.LockedBy)
	}

	if result.Error != gorm.ErrRecordNotFound {
		tx.Rollback()
		return fmt.Errorf("failed to check existing lock: %w", result.Error)
	}

	// Create new lock
	if err := tx.Create(&lock).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to acquire migration lock: %w", err)
	}

	return tx.Commit().Error
}

// waitForLock waits for the migration lock to be released
func (m *Migrator) waitForLock() error {
	timeout := time.After(10 * time.Minute) // Wait up to 10 minutes
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-timeout:
			return fmt.Errorf("timeout waiting for migration lock to be released")
		case <-ticker.C:
			var lockCount int64
			m.db.Model(&MigrationLock{}).Where("expires_at > ?", time.Now()).Count(&lockCount)
			if lockCount == 0 {
				return nil // Lock is released
			}
		}
	}
}

// releaseLock releases the migration lock held by this instance
func (m *Migrator) releaseLock() error {
	result := m.db.Where("locked_by = ?", m.instanceID).Delete(&MigrationLock{})

	if result.Error != nil {
		return fmt.Errorf("failed to release migration lock: %w", result.Error)
	}

	if result.RowsAffected == 0 {
		return fmt.Errorf("no lock found for instance: %s", m.instanceID)
	}

	return nil
}

// CleanupStuckMigrations removes stuck 'running' migrations after timeout
func (m *Migrator) CleanupStuckMigrations(timeoutMinutes int) error {
	if timeoutMinutes <= 0 {
		timeoutMinutes = 30 // Default 30 minutes timeout
	}

	cutoffTime := time.Now().Add(-time.Duration(timeoutMinutes) * time.Minute)

	result := m.db.Table(m.tableName).
		Where("status = ? AND started_at < ?", "running", cutoffTime).
		Updates(Migration{Status: "failed", ErrorMsg: "Migration stuck - cleaned up by timeout"})

	if result.Error != nil {
		return fmt.Errorf("failed to cleanup stuck migrations: %w", result.Error)
	}

	if result.RowsAffected > 0 {
		fmt.Printf("Cleaned up %d stuck migrations\n", result.RowsAffected)
	}

	return nil
}

// RetryFailedMigrations retries all failed migrations
func (m *Migrator) RetryFailedMigrations() error {
	// First cleanup any stuck running migrations
	if err := m.CleanupStuckMigrations(30); err != nil {
		return err
	}

	// Reset failed migrations to allow retry
	result := m.db.Table(m.tableName).Where("status IN (?)", []string{"failed", "running"}).Delete(&Migration{})
	if result.Error != nil {
		return fmt.Errorf("failed to reset failed migrations: %w", result.Error)
	}

	if result.RowsAffected > 0 {
		fmt.Printf("Reset %d failed/stuck migrations for retry\n", result.RowsAffected)
	}

	// Run migrations normally
	return m.Up()
}
