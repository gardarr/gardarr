package database

import (
	"os"
	"path/filepath"
	"testing"
)

// restoreWorkingDir restores the working directory and fails the test if it cannot be restored.
func restoreWorkingDir(t *testing.T, dir string) {
	if err := os.Chdir(dir); err != nil {
		t.Fatalf("Failed to restore working directory: %v", err)
	}
}

func TestEnsureSQLiteFile(t *testing.T) {
	tests := []struct {
		name      string
		filePath  string
		setupFunc func(t *testing.T, baseDir string) string
		validate  func(t *testing.T, filePath string)
		wantError bool
	}{
		{
			name:     "Create new file in current directory",
			filePath: "test_new.db",
			setupFunc: func(t *testing.T, baseDir string) string {
				// Remove file if it exists from previous test runs
				testFile := filepath.Join(baseDir, "test_new.db")
				os.Remove(testFile)
				return testFile
			},
			validate: func(t *testing.T, filePath string) {
				if _, err := os.Stat(filePath); os.IsNotExist(err) {
					t.Errorf("Expected file to exist at %s", filePath)
				}
				// Cleanup
				os.Remove(filePath)
			},
			wantError: false,
		},
		{
			name:     "Create file in nested directory",
			filePath: "test_dir/nested/test.db",
			setupFunc: func(t *testing.T, baseDir string) string {
				testFile := filepath.Join(baseDir, "test_dir/nested/test.db")
				// Remove directory if it exists
				os.RemoveAll(filepath.Join(baseDir, "test_dir"))
				return testFile
			},
			validate: func(t *testing.T, filePath string) {
				if _, err := os.Stat(filePath); os.IsNotExist(err) {
					t.Errorf("Expected file to exist at %s", filePath)
				}
				// Verify directory was created
				dir := filepath.Dir(filePath)
				if _, err := os.Stat(dir); os.IsNotExist(err) {
					t.Errorf("Expected directory to exist at %s", dir)
				}
				// Cleanup
				os.RemoveAll(filepath.Dir(filePath))
			},
			wantError: false,
		},
		{
			name:     "File already exists",
			filePath: "test_existing.db",
			setupFunc: func(t *testing.T, baseDir string) string {
				testFile := filepath.Join(baseDir, "test_existing.db")
				// Create file before test
				file, err := os.Create(testFile)
				if err != nil {
					t.Fatalf("Failed to create test file: %v", err)
				}
				file.Close()
				return testFile
			},
			validate: func(t *testing.T, filePath string) {
				if _, err := os.Stat(filePath); os.IsNotExist(err) {
					t.Errorf("Expected file to still exist at %s", filePath)
				}
				// Cleanup
				os.Remove(filePath)
			},
			wantError: false,
		},
		{
			name:     "Relative path",
			filePath: "./relative/test.db",
			setupFunc: func(t *testing.T, baseDir string) string {
				testFile := filepath.Join(baseDir, "relative/test.db")
				os.RemoveAll(filepath.Join(baseDir, "relative"))
				return testFile
			},
			validate: func(t *testing.T, filePath string) {
				if _, err := os.Stat(filePath); os.IsNotExist(err) {
					t.Errorf("Expected file to exist at %s", filePath)
				}
				// Cleanup
				os.RemoveAll(filepath.Dir(filePath))
			},
			wantError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create temporary directory for test
			tmpDir, err := os.MkdirTemp("", "gardarr_test_*")
			if err != nil {
				t.Fatalf("Failed to create temp directory: %v", err)
			}
			defer os.RemoveAll(tmpDir)

			// Change to temp directory
			oldWd, err := os.Getwd()
			if err != nil {
				t.Fatalf("Failed to get current directory: %v", err)
			}
			defer restoreWorkingDir(t, oldWd)

			if err := os.Chdir(tmpDir); err != nil {
				t.Fatalf("Failed to change to temp directory: %v", err)
			}

			// Setup test file path
			testFilePath := tt.setupFunc(t, tmpDir)

			// Get relative path for ensureSQLiteFile
			relPath, err := filepath.Rel(tmpDir, testFilePath)
			if err != nil {
				t.Fatalf("Failed to get relative path: %v", err)
			}

			// Execute function
			err = ensureSQLiteFile(relPath)

			// Validate results
			if (err != nil) != tt.wantError {
				t.Errorf("ensureSQLiteFile() error = %v, wantError %v", err, tt.wantError)
				return
			}

			if !tt.wantError {
				tt.validate(t, testFilePath)
			}
		})
	}
}

func TestEnsureSQLiteFileAbsolutePath(t *testing.T) {
	// Create temporary directory
	tmpDir, err := os.MkdirTemp("", "gardarr_test_*")
	if err != nil {
		t.Fatalf("Failed to create temp directory: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	testFile := filepath.Join(tmpDir, "absolute_test.db")
	os.Remove(testFile)

	// Test with absolute path
	err = ensureSQLiteFile(testFile)
	if err != nil {
		t.Errorf("ensureSQLiteFile() with absolute path error = %v, want nil", err)
	}

	// Verify file exists
	if _, err := os.Stat(testFile); os.IsNotExist(err) {
		t.Errorf("Expected file to exist at %s", testFile)
	}

	// Verify file permissions
	info, err := os.Stat(testFile)
	if err != nil {
		t.Fatalf("Failed to stat file: %v", err)
	}
	mode := info.Mode()
	expectedMode := os.FileMode(0600)
	if mode.Perm() != expectedMode {
		t.Errorf("Expected file permissions %v, got %v", expectedMode, mode.Perm())
	}
}

func TestEnsureSQLiteFile_DirectoryCreation(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "gardarr_test_*")
	if err != nil {
		t.Fatalf("Failed to create temp directory: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	os.RemoveAll(filepath.Join(tmpDir, "level1"))

	// Change to temp directory
	oldWd, err := os.Getwd()
	if err != nil {
		t.Fatalf("Failed to get current directory: %v", err)
	}
	defer restoreWorkingDir(t, oldWd)

	if err := os.Chdir(tmpDir); err != nil {
		t.Fatalf("Failed to change to temp directory: %v", err)
	}

	relPath := "level1/level2/level3/test.db"
	err = ensureSQLiteFile(relPath)
	if err != nil {
		t.Errorf("ensureSQLiteFile() error = %v, want nil", err)
	}

	// Verify all directories were created
	absPath, _ := filepath.Abs(relPath)
	if _, err := os.Stat(absPath); os.IsNotExist(err) {
		t.Errorf("Expected file to exist at %s", absPath)
	}

	// Verify nested directories exist
	dir := filepath.Dir(absPath)
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		t.Errorf("Expected nested directory to exist at %s", dir)
	}
}
