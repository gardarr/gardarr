package statistics

import (
	"context"
	"time"
)

// StatsProvider abstracts the storage backend for statistics data.
// Implementations include FilesystemProvider (default) and InfluxDBProvider.
type StatsProvider interface {
	// WriteSnapshots persists snapshot lines for an agent at a given timestamp.
	WriteSnapshots(ctx context.Context, agentID string, ts time.Time, lines []SnapshotLine) error

	// UpsertHourSummary stores or updates aggregated hourly statistics.
	UpsertHourSummary(ctx context.Context, agentID string, ts time.Time, data HourSummaryInput) error

	// ScanSnapshots reads all snapshot lines for an agent in a time range,
	// calling fn for each line. Implementations should respect context cancellation.
	ScanSnapshots(ctx context.Context, agentID string, from, to time.Time, fn func(*SnapshotLine)) error

	// GetHourSummaries retrieves hourly summaries for an agent in a date range.
	GetHourSummaries(ctx context.Context, agentID string, fromDate, toDate string) ([]HourSummaryRow, error)

	// GetDayIndex retrieves index entries for an agent on a specific date.
	GetDayIndex(ctx context.Context, agentID string, date string) ([]DayIndexRow, error)

	// GetTotalSize returns the total storage size in bytes used by statistics data.
	GetTotalSize(ctx context.Context) (int64, error)

	// Purge deletes data older than the given cutoff date (YYYY-MM-DD format).
	Purge(ctx context.Context, cutoffDate string) error

	// Close releases resources held by the provider.
	Close() error
}

// HourSummaryInput contains the data needed to upsert an hourly summary.
type HourSummaryInput struct {
	TasksSeen int
	DlActive  int
	UlActive  int
	TotalDlKB int64
	TotalUlKB int64
}

// HourSummaryRow represents a single hourly summary record returned by queries.
type HourSummaryRow struct {
	AgentID       string    `json:"agent_id"`
	Date          string    `json:"date"`
	Hour          int       `json:"hour"`
	TasksSeen     int       `json:"tasks_seen"`
	ActiveDlCount int       `json:"active_dl_count"`
	ActiveUlCount int       `json:"active_ul_count"`
	TotalDlKBs    int64     `json:"total_dl_kbs"`
	TotalUlKBs    int64     `json:"total_ul_kbs"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// DayIndexRow represents a single file/hour index entry returned by queries.
type DayIndexRow struct {
	AgentID   string    `json:"agent_id"`
	Date      string    `json:"date"`
	Hour      int       `json:"hour"`
	FilePath  string    `json:"file_path,omitempty"`
	StartTS   time.Time `json:"start_ts"`
	EndTS     time.Time `json:"end_ts"`
	LineCount int       `json:"line_count"`
	SizeBytes int64     `json:"size_bytes"`
}
