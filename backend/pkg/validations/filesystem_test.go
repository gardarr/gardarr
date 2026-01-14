package validations

import (
	"os"
	"path/filepath"
	"testing"
)

const (
	setupFailedMsg = "setup failed: %v"
	testFileName   = "file.txt"
)

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
			dir:  filepath.Join(tmpDir, testFileName),
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

func TestIsPathWithinBase(t *testing.T) {
	tmpDir := t.TempDir()
	subDir := filepath.Join(tmpDir, "subdir")
	_ = os.MkdirAll(subDir, 0755)

	tests := []struct {
		name   string
		base   string
		path   string
		expect bool
	}{
		{
			name:   "path within base",
			base:   tmpDir,
			path:   filepath.Join(tmpDir, testFileName),
			expect: true,
		},
		{
			name:   "path in subdirectory",
			base:   tmpDir,
			path:   filepath.Join(tmpDir, "subdir", testFileName),
			expect: true,
		},
		{
			name:   "path is base itself",
			base:   tmpDir,
			path:   tmpDir,
			expect: true,
		},
		{
			name:   "path outside base via parent",
			base:   subDir,
			path:   filepath.Join(subDir, "..", "outside.txt"),
			expect: false,
		},
		{
			name:   "path completely outside base",
			base:   subDir,
			path:   "/etc/passwd",
			expect: false,
		},
		{
			name:   "path with dot-dot traversal",
			base:   tmpDir,
			path:   filepath.Join(tmpDir, "subdir", "..", "..", "escape.txt"),
			expect: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := IsPathWithinBase(tt.base, tt.path)
			if result != tt.expect {
				t.Errorf("IsPathWithinBase(%q, %q) = %v, want %v", tt.base, tt.path, result, tt.expect)
			}
		})
	}
}

func TestValidatePathComponent(t *testing.T) {
	tests := []struct {
		name      string
		component string
		wantErr   error
	}{
		{
			name:      "valid filename",
			component: testFileName,
			wantErr:   nil,
		},
		{
			name:      "valid directory name",
			component: "my-folder_123",
			wantErr:   nil,
		},
		{
			name:      "empty component",
			component: "",
			wantErr:   ErrInvalidPathComponent,
		},
		{
			name:      "double dot traversal",
			component: "..",
			wantErr:   ErrPathTraversal,
		},
		{
			name:      "single dot",
			component: ".",
			wantErr:   ErrPathTraversal,
		},
		{
			name:      "contains forward slash",
			component: "path/to/file",
			wantErr:   ErrPathTraversal,
		},
		{
			name:      "contains backslash",
			component: "path\\to\\file",
			wantErr:   ErrPathTraversal,
		},
		{
			name:      "contains null byte",
			component: "file\x00.txt",
			wantErr:   ErrInvalidPathComponent,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidatePathComponent(tt.component)
			if tt.wantErr == nil && err != nil {
				t.Errorf("ValidatePathComponent(%q) unexpected error: %v", tt.component, err)
			} else if tt.wantErr != nil && err != tt.wantErr {
				t.Errorf("ValidatePathComponent(%q) = %v, want %v", tt.component, err, tt.wantErr)
			}
		})
	}
}

func TestValidateSafePathComponent(t *testing.T) {
	tests := []struct {
		name      string
		component string
		wantErr   bool
	}{
		{
			name:      "valid uuid style",
			component: "550e8400-e29b-41d4-a716-446655440000",
			wantErr:   false,
		},
		{
			name:      "valid alphanumeric",
			component: "agent123",
			wantErr:   false,
		},
		{
			name:      "valid with underscore",
			component: "my_agent_01",
			wantErr:   false,
		},
		{
			name:      "valid with dots",
			component: "file.backup.txt",
			wantErr:   false,
		},
		{
			name:      "starts with dot (hidden file)",
			component: ".hidden",
			wantErr:   true,
		},
		{
			name:      "contains special characters",
			component: "agent@123",
			wantErr:   true,
		},
		{
			name:      "contains spaces",
			component: "my agent",
			wantErr:   true,
		},
		{
			name:      "empty string",
			component: "",
			wantErr:   true,
		},
		{
			name:      "path traversal attempt",
			component: "../etc/passwd",
			wantErr:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateSafePathComponent(tt.component)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateSafePathComponent(%q) error = %v, wantErr %v", tt.component, err, tt.wantErr)
			}
		})
	}
}

func TestSafeJoinPath(t *testing.T) {
	tmpDir := t.TempDir()

	tests := []struct {
		name       string
		base       string
		components []string
		wantErr    bool
	}{
		{
			name:       "simple join",
			base:       tmpDir,
			components: []string{"subdir", testFileName},
			wantErr:    false,
		},
		{
			name:       "single component",
			base:       tmpDir,
			components: []string{testFileName},
			wantErr:    false,
		},
		{
			name:       "traversal attempt with dot-dot",
			base:       tmpDir,
			components: []string{"..", "escape.txt"},
			wantErr:    true,
		},
		{
			name:       "component with slash",
			base:       tmpDir,
			components: []string{"path/file.txt"},
			wantErr:    true,
		},
		{
			name:       "empty component",
			base:       tmpDir,
			components: []string{"valid", "", testFileName},
			wantErr:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := SafeJoinPath(tt.base, tt.components...)
			if (err != nil) != tt.wantErr {
				t.Errorf("SafeJoinPath() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && result == "" {
				t.Error("SafeJoinPath() returned empty path for valid input")
			}
		})
	}
}
