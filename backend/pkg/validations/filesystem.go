package validations

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/jfxdev/gardarr/pkg/logger"
)

var (
	// ErrPathTraversal is returned when a path traversal attempt is detected
	ErrPathTraversal = errors.New("path traversal attempt detected")
	// ErrInvalidPathComponent is returned when a path component contains invalid characters
	ErrInvalidPathComponent = errors.New("path component contains invalid characters")

	// safePathComponentPattern matches valid path components (alphanumeric, dash, underscore, dot)
	// Does not allow leading dots to prevent hidden file access
	safePathComponentPattern = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9._-]*$`)
)

// IsPathWithinBase checks if the given path is safely contained within the base directory.
// It resolves both paths to absolute form and ensures the target doesn't escape the base.
// Returns true if path is within base, false otherwise.
func IsPathWithinBase(base, path string) bool {
	// Clean and resolve paths
	absBase, err := filepath.Abs(filepath.Clean(base))
	if err != nil {
		return false
	}
	absPath, err := filepath.Abs(filepath.Clean(path))
	if err != nil {
		return false
	}

	// Ensure base ends with separator for proper prefix matching
	if !strings.HasSuffix(absBase, string(os.PathSeparator)) {
		absBase += string(os.PathSeparator)
	}

	// Check if path is within base (or is the base itself minus separator)
	return strings.HasPrefix(absPath+string(os.PathSeparator), absBase)
}

// ValidatePathComponent checks if a single path component (filename or directory name)
// is safe to use. Returns an error if the component contains path separators,
// traversal sequences, or other dangerous characters.
func ValidatePathComponent(component string) error {
	if component == "" {
		return ErrInvalidPathComponent
	}

	// Check for path separators
	if strings.ContainsAny(component, `/\`) {
		return ErrPathTraversal
	}

	// Check for parent directory references
	if component == ".." || component == "." {
		return ErrPathTraversal
	}

	// Check for null bytes (can truncate paths in some systems)
	if strings.ContainsRune(component, '\x00') {
		return ErrInvalidPathComponent
	}

	return nil
}

// ValidateSafePathComponent performs strict validation on a path component,
// ensuring it only contains safe alphanumeric characters, dashes, underscores, and dots.
// This is useful for user-provided identifiers like agent IDs.
func ValidateSafePathComponent(component string) error {
	if err := ValidatePathComponent(component); err != nil {
		return err
	}

	if !safePathComponentPattern.MatchString(component) {
		return ErrInvalidPathComponent
	}

	return nil
}

// SafeJoinPath safely joins a base path with untrusted path components.
// It validates each component and ensures the result stays within the base directory.
// Returns the cleaned, absolute path if valid, or an error if the path is unsafe.
func SafeJoinPath(base string, components ...string) (string, error) {
	// Validate and clean base
	absBase, err := filepath.Abs(filepath.Clean(base))
	if err != nil {
		return "", fmt.Errorf("invalid base path: %w", err)
	}

	// Validate each component
	for _, comp := range components {
		if err := ValidatePathComponent(comp); err != nil {
			return "", fmt.Errorf("invalid path component %q: %w", comp, err)
		}
	}

	// Join paths
	parts := append([]string{absBase}, components...)
	result := filepath.Join(parts...)
	result = filepath.Clean(result)

	// Verify result is within base
	if !IsPathWithinBase(absBase, result) {
		return "", ErrPathTraversal
	}

	return result, nil
}

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
