package statistics

import (
	"context"
	"os"
	"path/filepath"
	"strconv"
	"testing"
	"time"

	"github.com/gardarr/gardarr/internal/infra/database"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseTime(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		wantErr bool
	}{
		{
			name:    "RFC3339 format",
			input:   "2024-01-15T10:30:00Z",
			wantErr: false,
		},
		{
			name:    "Date with time format",
			input:   "2024-01-15 10:30:00",
			wantErr: false,
		},
		{
			name:    "Date only format",
			input:   "2024-01-15",
			wantErr: false,
		},
		{
			name:    "Invalid format",
			input:   "invalid-date",
			wantErr: true,
		},
		{
			name:    "Empty string",
			input:   "",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := ParseTime(tt.input)
			if tt.wantErr {
				assert.Error(t, err)
				assert.True(t, result.IsZero())
			} else {
				assert.NoError(t, err)
				assert.False(t, result.IsZero())
			}
		})
	}
}

func TestService_ScanFile(t *testing.T) {
	// Create a temporary directory for test files
	tmpDir := t.TempDir()

	// Create a test service
	db := &database.Database{}
	svc := &Service{
		db:      db,
		baseDir: tmpDir,
	}

	t.Run("Empty path", func(t *testing.T) {
		err := svc.ScanFile("", func(*SnapshotLine) {})
		assert.NoError(t, err)
	})

	t.Run("Non-existent file", func(t *testing.T) {
		err := svc.ScanFile(filepath.Join(tmpDir, "nonexistent.gz"), func(*SnapshotLine) {})
		assert.Error(t, err)
	})

	t.Run("Invalid gzip file", func(t *testing.T) {
		invalidFile := filepath.Join(tmpDir, "invalid.gz")
		err := os.WriteFile(invalidFile, []byte("not a gzip file"), 0644)
		require.NoError(t, err)

		err = svc.ScanFile(invalidFile, func(*SnapshotLine) {})
		assert.Error(t, err)
	})
}

func TestService_DiscoverFiles(t *testing.T) {
	// Create a temporary directory for test files
	tmpDir := t.TempDir()

	// Create a minimal test database (you may need to adjust this based on your DB setup)
	db := &database.Database{}

	svc := &Service{
		db:      db,
		baseDir: tmpDir,
	}

	ctx := context.Background()
	agentID := "test-agent-123"
	from := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
	to := time.Date(2024, 1, 3, 0, 0, 0, 0, time.UTC)

	t.Run("No files found", func(t *testing.T) {
		files, err := svc.DiscoverFiles(ctx, agentID, from, to)
		// Should not error, just return empty list
		assert.NoError(t, err)
		assert.Empty(t, files)
	})

	t.Run("Discovers files from filesystem", func(t *testing.T) {
		// Create test file structure
		year := "2024"
		month := "01"
		agentDir := filepath.Join(tmpDir, year, month, agentID)
		err := os.MkdirAll(agentDir, 0755)
		require.NoError(t, err)

		// Create a test file
		testFile := filepath.Join(agentDir, agentID+"-2024-01-02.jsonl.gz")
		err = os.WriteFile(testFile, []byte{}, 0644)
		require.NoError(t, err)

		files, err := svc.DiscoverFiles(ctx, agentID, from, to)
		assert.NoError(t, err)
		assert.NotEmpty(t, files)
		assert.Contains(t, files[0], agentID+"-2024-01-02.jsonl.gz")
	})
}

func TestService_WindowedAggregation(t *testing.T) {
	tmpDir := t.TempDir()
	db := &database.Database{}

	svc := &Service{
		db:      db,
		baseDir: tmpDir,
	}

	ctx := context.Background()
	agentID := "test-agent"
	from := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
	to := time.Date(2024, 1, 2, 0, 0, 0, 0, time.UTC)
	step := 5 * time.Minute

	t.Run("Group by agent with no files", func(t *testing.T) {
		result, err := svc.GetWindowedAggregation(ctx, agentID, from, to, step, "agent", []string{})
		assert.NoError(t, err)
		assert.NotNil(t, result)

		// Should return empty map
		resultMap, ok := result.(map[string]WindowedAggregation)
		assert.True(t, ok)
		assert.Empty(t, resultMap)
	})

	t.Run("Group by task with no files", func(t *testing.T) {
		result, err := svc.GetWindowedAggregation(ctx, agentID, from, to, step, "task", []string{})
		assert.NoError(t, err)
		assert.NotNil(t, result)

		// Should return empty map
		resultMap, ok := result.(map[string]map[string]WindowedAggregation)
		assert.True(t, ok)
		assert.Empty(t, resultMap)
	})
}

func TestService_GetUploadDiffs(t *testing.T) {
	tmpDir := t.TempDir()
	db := &database.Database{}

	svc := &Service{
		db:      db,
		baseDir: tmpDir,
	}

	ctx := context.Background()
	agentID := "test-agent"
	from := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
	to := time.Date(2024, 1, 2, 0, 0, 0, 0, time.UTC)
	step := 5 * time.Minute
	limit := 10

	t.Run("No files returns empty results", func(t *testing.T) {
		results, err := svc.GetUploadDiffs(ctx, agentID, from, to, step, limit)
		assert.NoError(t, err)
		assert.NotNil(t, results)
		assert.Empty(t, results)
	})

	t.Run("Limit parameter is respected", func(t *testing.T) {
		// Seed >5 task-window entries inside the [from,to] range
		// Create a single daily file for 2024-01-01 with multiple tasks
		var fw FileWriter
		require.NoError(t, fw.OpenDaily(tmpDir, agentID, time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)))
		// Each task gets two lines within the same 5-minute window so that Diff > 0
		baseTS := time.Date(2024, 1, 1, 12, 0, 0, 0, time.UTC)
		for i := 0; i < 6; i++ { // 6 tasks > limit(5)
			taskID := "task-" + strconv.Itoa(i)
			_ = fw.WriteLine(SnapshotLine{TS: baseTS, Task: taskID, UlB: 100})
			_ = fw.WriteLine(SnapshotLine{TS: baseTS.Add(1 * time.Minute), Task: taskID, UlB: 200})
		}
		require.NoError(t, fw.Flush())
		require.NoError(t, fw.Close())

		results, err := svc.GetUploadDiffs(ctx, agentID, from, to, step, 5)
		assert.NoError(t, err)
		assert.Equal(t, 5, len(results))
	})
}

func TestService_PurgeOldFiles_FSOnly(t *testing.T) {
	tmpDir := t.TempDir()
	svc := &Service{
		baseDir:       tmpDir,
		retentionDays: 10,
	}

	// Create files with dates inside name: <agent>-YYYY-MM-DD.jsonl.gz
	mustWrite := func(rel string) string {
		p := filepath.Join(tmpDir, rel)
		require.NoError(t, os.MkdirAll(filepath.Dir(p), 0o755))
		require.NoError(t, os.WriteFile(p, []byte{}, 0o644))
		return p
	}

	// cutoff is now-10d, so a file 15 days ago should be deleted, 5 days ago kept
	oldDate := time.Now().UTC().AddDate(0, 0, -15).Format("2006-01-02")
	newDate := time.Now().UTC().AddDate(0, 0, -5).Format("2006-01-02")

	oldFile := mustWrite(filepath.Join("2024", "01", "agent-x", "agent-x-"+oldDate+".jsonl.gz"))
	newFile := mustWrite(filepath.Join("2024", "01", "agent-x", "agent-x-"+newDate+".jsonl.gz"))

	// Run purge (DB is nil so it will skip DB part)
	err := svc.PurgeOldFiles(context.Background())
	require.NoError(t, err)

	// Old should be removed, new should remain
	_, err = os.Stat(oldFile)
	assert.True(t, os.IsNotExist(err))

	_, err = os.Stat(newFile)
	assert.NoError(t, err)
}
