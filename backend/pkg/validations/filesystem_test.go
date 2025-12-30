package validations

import (
	"os"
	"path/filepath"
	"testing"
)

const setupFailedMsg = "setup failed: %v"

func setupReadOnlyDir(tmpDir string) func() error {
	return func() error {
		dir := filepath.Join(tmpDir, "readonly")
		if err := os.MkdirAll(dir, 0755); err != nil {
			return err
		}
		return os.Chmod(dir, 0555)
	}
}

func cleanupReadOnlyDir(tmpDir string) func() {
	return func() {
		dir := filepath.Join(tmpDir, "readonly")
		_ = os.Chmod(dir, 0755)
	}
}

func TestValidateDataDirectories(t *testing.T) {
	tmpDir := t.TempDir()

	tests := []struct {
		name    string
		dirs    []string
		setup   func() error
		cleanup func()
		wantErr bool
	}{
		{
			name:    "valid writable directory",
			dirs:    []string{tmpDir},
			wantErr: false,
		},
		{
			name:    "multiple valid directories",
			dirs:    []string{tmpDir, filepath.Join(tmpDir, "subdir")},
			wantErr: false,
		},
		{
			name:    "non-existent directory (should create)",
			dirs:    []string{filepath.Join(tmpDir, "new-dir")},
			wantErr: false,
		},
		{
			name:    "read-only directory (permission denied)",
			dirs:    []string{filepath.Join(tmpDir, "readonly")},
			setup:   setupReadOnlyDir(tmpDir),
			cleanup: cleanupReadOnlyDir(tmpDir),
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setup != nil {
				if err := tt.setup(); err != nil {
					t.Fatalf(setupFailedMsg, err)
				}
			}
			if tt.cleanup != nil {
				defer tt.cleanup()
			}

			err := ValidateDataDirectories(tt.dirs...)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateDataDirectories() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func setupExistingDBFile() func(string) error {
	return func(path string) error {
		return os.WriteFile(path, []byte("test"), 0644)
	}
}

func setupReadOnlyDBFile() func(string) error {
	return func(path string) error {
		if err := os.WriteFile(path, []byte("test"), 0644); err != nil {
			return err
		}
		return os.Chmod(path, 0444)
	}
}

func cleanupReadOnlyDBFile() func(string) {
	return func(path string) {
		_ = os.Chmod(path, 0644)
	}
}

func setupReadOnlyDBDir() func(string) error {
	return func(path string) error {
		dir := filepath.Dir(path)
		if err := os.MkdirAll(dir, 0755); err != nil {
			return err
		}
		return os.Chmod(dir, 0555)
	}
}

func cleanupReadOnlyDBDir() func(string) {
	return func(path string) {
		dir := filepath.Dir(path)
		_ = os.Chmod(dir, 0755)
	}
}

func TestValidateDatabasePath(t *testing.T) {
	tmpDir := t.TempDir()

	tests := []struct {
		name    string
		dbPath  string
		setup   func(string) error
		cleanup func(string)
		wantErr bool
	}{
		{
			name:    "valid database path in writable directory",
			dbPath:  filepath.Join(tmpDir, "test.db"),
			wantErr: false,
		},
		{
			name:    "existing database file",
			dbPath:  filepath.Join(tmpDir, "existing.db"),
			setup:   setupExistingDBFile(),
			wantErr: false,
		},
		{
			name:    "read-only database file (permission denied)",
			dbPath:  filepath.Join(tmpDir, "readonly.db"),
			setup:   setupReadOnlyDBFile(),
			cleanup: cleanupReadOnlyDBFile(),
			wantErr: true,
		},
		{
			name:    "database in read-only directory",
			dbPath:  filepath.Join(tmpDir, "readonly-dir", "test.db"),
			setup:   setupReadOnlyDBDir(),
			cleanup: cleanupReadOnlyDBDir(),
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setup != nil {
				if err := tt.setup(tt.dbPath); err != nil {
					t.Fatalf(setupFailedMsg, err)
				}
			}
			if tt.cleanup != nil {
				defer tt.cleanup(tt.dbPath)
			}

			err := ValidateDatabasePath(tt.dbPath)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateDatabasePath() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestEnsureDirectoryWritable(t *testing.T) {
	tmpDir := t.TempDir()

	tests := []struct {
		name    string
		dir     string
		setup   func(string) error
		wantErr bool
	}{
		{
			name:    "writable directory",
			dir:     tmpDir,
			wantErr: false,
		},
		{
			name:    "create new directory",
			dir:     filepath.Join(tmpDir, "newdir"),
			wantErr: false,
		},
		{
			name: "file instead of directory",
			dir:  filepath.Join(tmpDir, "file.txt"),
			setup: func(path string) error {
				return os.WriteFile(path, []byte("test"), 0644)
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setup != nil {
				if err := tt.setup(tt.dir); err != nil {
					t.Fatalf(setupFailedMsg, err)
				}
			}

			err := ensureDirectoryWritable(tt.dir)
			if (err != nil) != tt.wantErr {
				t.Errorf("ensureDirectoryWritable() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
