package validations

import (
	"os"
	"path/filepath"
	"testing"
)

func TestValidateDataDirectories(t *testing.T) {
	// Create a temporary directory for testing
	tmpDir := t.TempDir()

	tests := []struct {
		name    string
		dirs    []string
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
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateDataDirectories(tt.dirs...)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateDataDirectories() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestValidateDatabasePath(t *testing.T) {
	tmpDir := t.TempDir()

	tests := []struct {
		name    string
		dbPath  string
		setup   func(string) error
		wantErr bool
	}{
		{
			name:    "valid database path in writable directory",
			dbPath:  filepath.Join(tmpDir, "test.db"),
			wantErr: false,
		},
		{
			name:   "existing database file",
			dbPath: filepath.Join(tmpDir, "existing.db"),
			setup: func(path string) error {
				return os.WriteFile(path, []byte("test"), 0644)
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setup != nil {
				if err := tt.setup(tt.dbPath); err != nil {
					t.Fatalf("setup failed: %v", err)
				}
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
					t.Fatalf("setup failed: %v", err)
				}
			}

			err := ensureDirectoryWritable(tt.dir)
			if (err != nil) != tt.wantErr {
				t.Errorf("ensureDirectoryWritable() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
