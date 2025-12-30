package validations

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/jfxdev/gardarr/pkg/logger"
)

// ValidateDataDirectories ensures that required data directories exist and are writable.
// This function is typically called with directories obtained from environment variables:
// - TORRENT_IMAGE_UPLOAD_DIR (default: /media/uploads/images)
// - STATISTICS_DIR (default: /data/statistics)
// The directories will be created if they don't exist, with permissions 0755.
func ValidateDataDirectories(dataDirs ...string) error {
	for _, dir := range dataDirs {
		if err := ensureDirectoryWritable(dir); err != nil {
			return fmt.Errorf("data directory validation failed for %s: %w", dir, err)
		}
	}
	return nil
}

// ensureDirectoryWritable checks if a directory exists and is writable
// If the directory doesn't exist, it attempts to create it
func ensureDirectoryWritable(dir string) error {
	// Clean the path
	dir = filepath.Clean(dir)

	// Check if directory exists
	info, err := os.Stat(dir)
	if os.IsNotExist(err) {
		// Try to create the directory
		if err := os.MkdirAll(dir, 0755); err != nil {
			return fmt.Errorf("failed to create directory: %w", err)
		}
		// Directory created, fall through to writability test
	} else if err != nil {
		return fmt.Errorf("failed to stat directory: %w", err)
	} else if !info.IsDir() {
		// Verify it's a directory
		return fmt.Errorf("path exists but is not a directory")
	}

	// Test write permissions by creating a temporary file
	testFile := filepath.Join(dir, ".write_test")
	f, err := os.Create(testFile)
	if err != nil {
		return fmt.Errorf("directory is not writable (permission denied): %w\nHint: Ensure the container user has write permissions to this directory", err)
	}
	defer f.Close()

	// Clean up test file
	defer func() {
		if err := os.Remove(testFile); err != nil {
			// Log but don't fail if we can't remove the test file
			logger.Logger.Warn("failed to remove test file",
				"path", testFile,
				"error", err)
		}
	}()

	return nil
}

// ValidateDatabasePath ensures the database file path is valid and writable.
// This function validates the path obtained from the DATABASE_FILE_PATH environment variable
// (default: /data/gardarr_database.db). It ensures:
// 1. The parent directory exists and is writable (creates it if needed)
// 2. If the database file exists, it is writable
// This allows users to specify custom database locations via environment variables.
func ValidateDatabasePath(dbPath string) error {
	// Clean the path
	dbPath = filepath.Clean(dbPath)

	// Get the directory containing the database file
	dbDir := filepath.Dir(dbPath)

	// Ensure the directory exists and is writable
	if err := ensureDirectoryWritable(dbDir); err != nil {
		return fmt.Errorf("database directory validation failed: %w", err)
	}

	// If the database file exists, check if it's writable
	if _, err := os.Stat(dbPath); err == nil {
		// File exists, try to open it for writing
		// Note: perm argument (0) is ignored when opening existing files (only used with O_CREATE)
		f, err := os.OpenFile(dbPath, os.O_WRONLY|os.O_APPEND, 0)
		if err != nil {
			return fmt.Errorf("database file exists but is not writable: %w", err)
		}
		f.Close()
	}

	return nil
}
