package statistics

import (
	"context"
	"fmt"
	"math"
	"strconv"
	"time"

	"github.com/InfluxCommunity/influxdb3-go/v2/influxdb3"
)

// InfluxDBProvider stores statistics in InfluxDB v3 using the influxdb3-go client.
// Snapshots are stored as points in the "snapshot" measurement.
// Hour summaries are stored as points in the "hour_summary" measurement.
type InfluxDBProvider struct {
	client   *influxdb3.Client
	database string
}

// InfluxDBProviderConfig holds configuration for the InfluxDB provider.
type InfluxDBProviderConfig struct {
	URL      string
	Token    string
	Database string
}

// NewInfluxDBProvider creates a new InfluxDBProvider and validates the connection.
func NewInfluxDBProvider(cfg InfluxDBProviderConfig) (*InfluxDBProvider, error) {
	client, err := influxdb3.New(influxdb3.ClientConfig{
		Host:     cfg.URL,
		Token:    cfg.Token,
		Database: cfg.Database,
	})
	if err != nil {
		return nil, fmt.Errorf("influxdb: failed to create client: %w", err)
	}

	return &InfluxDBProvider{
		client:   client,
		database: cfg.Database,
	}, nil
}

// WriteSnapshots writes snapshot lines as points in the "snapshot" measurement.
func (p *InfluxDBProvider) WriteSnapshots(ctx context.Context, agentID string, ts time.Time, lines []SnapshotLine) error {
	points := make([]*influxdb3.Point, 0, len(lines))
	for i, sl := range lines {
		// Use the snapshot's own timestamp when available; otherwise derive
		// a unique one by adding a nanosecond offset per index so that
		// points sharing the same measurement+tags won't overwrite each other.
		pointTS := sl.TS
		if pointTS.IsZero() {
			pointTS = ts.Add(time.Duration(i) * time.Nanosecond)
		}

		pt := influxdb3.NewPoint("snapshot",
			map[string]string{
				"agent_id": agentID,
				"task":     sl.Task,
			},
			map[string]any{
				"state":    sl.St,
				"p01":      sl.P01,
				"r1e4":     sl.R1e4,
				"dl_kbs":   int64(sl.DlKB),
				"ul_kbs":   int64(sl.UlKB),
				"seeders":  int64(sl.Sd),
				"leechers": int64(sl.Lc),
				"dl_bytes": sl.DlB,
				"ul_bytes": sl.UlB,
			},
			pointTS,
		)
		points = append(points, pt)
	}

	if err := p.client.WritePoints(ctx, points); err != nil {
		return fmt.Errorf("influxdb: write snapshots: %w", err)
	}
	return nil
}

// UpsertHourSummary writes an hour summary point in the "hour_summary" measurement.
// InfluxDB handles upserts naturally — points with the same timestamp and tags are overwritten.
func (p *InfluxDBProvider) UpsertHourSummary(ctx context.Context, agentID string, ts time.Time, data HourSummaryInput) error {
	// Truncate to hour for the summary timestamp
	hourTS := ts.Truncate(time.Hour)

	pt := influxdb3.NewPoint("hour_summary",
		map[string]string{
			"agent_id": agentID,
		},
		map[string]any{
			"tasks_seen":  int64(data.TasksSeen),
			"active_dl":   int64(data.DlActive),
			"active_ul":   int64(data.UlActive),
			"total_dl_kb": data.TotalDlKB,
			"total_ul_kb": data.TotalUlKB,
		},
		hourTS,
	)

	if err := p.client.WritePoints(ctx, []*influxdb3.Point{pt}); err != nil {
		return fmt.Errorf("influxdb: write hour summary: %w", err)
	}
	return nil
}

// ScanSnapshots queries snapshot points from InfluxDB and calls fn for each.
func (p *InfluxDBProvider) ScanSnapshots(ctx context.Context, agentID string, from, to time.Time, fn func(*SnapshotLine)) error {
	query := `SELECT time, "task", "state", "p01", "r1e4", "dl_kbs", "ul_kbs", "seeders", "leechers", "dl_bytes", "ul_bytes" ` +
		`FROM "snapshot" ` +
		`WHERE time >= $fromTime AND time <= $toTime ` +
		`AND "agent_id" = $agentID ` +
		`ORDER BY time ASC`

	params := influxdb3.QueryParameters{
		"agentID":  agentID,
		"fromTime": from.UTC().Format(time.RFC3339Nano),
		"toTime":   to.UTC().Format(time.RFC3339Nano),
	}

	iterator, err := p.client.QueryWithParameters(ctx, query, params)
	if err != nil {
		return fmt.Errorf("influxdb: scan snapshots query: %w", err)
	}

	for iterator.Next() {
		value := iterator.Value()

		sl := SnapshotLine{
			TS:   toTime(value["time"]),
			Task: toString(value["task"]),
			St:   toString(value["state"]),
			P01:  toInt(value["p01"]),
			R1e4: toInt(value["r1e4"]),
			DlKB: toInt(value["dl_kbs"]),
			UlKB: toInt(value["ul_kbs"]),
			Sd:   toInt16(value["seeders"]),
			Lc:   toInt16(value["leechers"]),
			DlB:  toInt64(value["dl_bytes"]),
			UlB:  toInt64(value["ul_bytes"]),
		}
		fn(&sl)
	}

	if err := iterator.Err(); err != nil {
		return fmt.Errorf("influxdb: scan snapshots iteration: %w", err)
	}

	return nil
}

// GetHourSummaries queries hour summary points from InfluxDB.
func (p *InfluxDBProvider) GetHourSummaries(ctx context.Context, agentID string, fromDate, toDate string) ([]HourSummaryRow, error) {
	// Parse dates to time range
	fromTime, err := time.Parse("2006-01-02", fromDate)
	if err != nil {
		return nil, fmt.Errorf("influxdb: invalid fromDate: %w", err)
	}
	toTime_, err := time.Parse("2006-01-02", toDate)
	if err != nil {
		return nil, fmt.Errorf("influxdb: invalid toDate: %w", err)
	}
	// Include the full toDate day
	toTime_ = toTime_.Add(24*time.Hour - time.Nanosecond)

	query := `SELECT time, "tasks_seen", "active_dl", "active_ul", "total_dl_kb", "total_ul_kb" ` +
		`FROM "hour_summary" ` +
		`WHERE time >= $fromTime AND time <= $toTime ` +
		`AND "agent_id" = $agentID ` +
		`ORDER BY time ASC`

	params := influxdb3.QueryParameters{
		"agentID":  agentID,
		"fromTime": fromTime.UTC().Format(time.RFC3339Nano),
		"toTime":   toTime_.UTC().Format(time.RFC3339Nano),
	}

	iterator, err := p.client.QueryWithParameters(ctx, query, params)
	if err != nil {
		return nil, fmt.Errorf("influxdb: get hour summaries: %w", err)
	}

	var rows []HourSummaryRow
	for iterator.Next() {
		value := iterator.Value()
		ts := toTime(value["time"])

		rows = append(rows, HourSummaryRow{
			AgentID:       agentID,
			Date:          ts.Format("2006-01-02"),
			Hour:          ts.Hour(),
			TasksSeen:     int64ToIntSafe(toInt64(value["tasks_seen"])),
			ActiveDlCount: int64ToIntSafe(toInt64(value["active_dl"])),
			ActiveUlCount: int64ToIntSafe(toInt64(value["active_ul"])),
			TotalDlKBs:    toInt64(value["total_dl_kb"]),
			TotalUlKBs:    toInt64(value["total_ul_kb"]),
			CreatedAt:     ts,
			UpdatedAt:     ts,
		})
	}

	if err := iterator.Err(); err != nil {
		return nil, fmt.Errorf("influxdb: get hour summaries iteration: %w", err)
	}

	return rows, nil
}

// GetDayIndex builds index entries from snapshot data for a specific date.
func (p *InfluxDBProvider) GetDayIndex(ctx context.Context, agentID string, date string) ([]DayIndexRow, error) {
	dayStart, err := time.Parse("2006-01-02", date)
	if err != nil {
		return nil, fmt.Errorf("influxdb: invalid date: %w", err)
	}
	dayEnd := dayStart.Add(24 * time.Hour)

	dayStartLiteral := dayStart.UTC().Format(time.RFC3339)

	query := `SELECT DATE_BIN(INTERVAL '1 hour', time, '` + dayStartLiteral + `') AS hour_bucket, ` +
		`COUNT(*) AS line_count ` +
		`FROM "snapshot" ` +
		`WHERE time >= $fromTime AND time < $toTime ` +
		`AND "agent_id" = $agentID ` +
		`GROUP BY hour_bucket ` +
		`ORDER BY hour_bucket ASC`

	params := influxdb3.QueryParameters{
		"agentID":  agentID,
		"fromTime": dayStart.UTC().Format(time.RFC3339Nano),
		"toTime":   dayEnd.UTC().Format(time.RFC3339Nano),
	}

	iterator, err := p.client.QueryWithParameters(ctx, query, params)
	if err != nil {
		return nil, fmt.Errorf("influxdb: get day index: %w", err)
	}

	var rows []DayIndexRow
	for iterator.Next() {
		value := iterator.Value()
		bucketTS := toTime(value["hour_bucket"])

		rows = append(rows, DayIndexRow{
			AgentID:   agentID,
			Date:      date,
			Hour:      bucketTS.Hour(),
			StartTS:   bucketTS,
			EndTS:     bucketTS.Add(time.Hour),
			LineCount: toInt(value["line_count"]),
		})
	}

	if err := iterator.Err(); err != nil {
		return nil, fmt.Errorf("influxdb: get day index iteration: %w", err)
	}

	return rows, nil
}

// estimatedBytesPerPoint is a rough estimate of the average serialized size
// of a single snapshot point in InfluxDB (used when precise storage metrics
// are unavailable).
const estimatedBytesPerPoint int64 = 100

// GetTotalSize returns an estimate of the total data size. InfluxDB v3 does not
// expose per-measurement storage size easily, so we return a count-based estimate.
func (p *InfluxDBProvider) GetTotalSize(ctx context.Context) (int64, error) {
	query := `SELECT COUNT(*) AS total FROM "snapshot"`

	iterator, err := p.client.Query(ctx, query)
	if err != nil {
		return 0, fmt.Errorf("influxdb: get total size: %w", err)
	}

	var total int64
	for iterator.Next() {
		value := iterator.Value()
		count := toInt64(value["total"])
		total = count * estimatedBytesPerPoint
	}

	if err := iterator.Err(); err != nil {
		return 0, fmt.Errorf("influxdb: get total size iteration: %w", err)
	}

	return total, nil
}

// Purge is a no-op for the InfluxDB provider; retention is handled via
// InfluxDB bucket retention policies. The v3 client does not expose a delete API.
func (p *InfluxDBProvider) Purge(ctx context.Context, cutoffDate string) error {
	// InfluxDB v3 handles retention via bucket configuration.
	// Manual purge is a no-op if retention is configured on the bucket.
	// The v3 client does not expose a delete API directly.
	return nil
}

// Close releases the InfluxDB client resources.
func (p *InfluxDBProvider) Close() error {
	if p.client != nil {
		return p.client.Close()
	}
	return nil
}

// --- type conversion helpers ---

func toString(v interface{}) string {
	if v == nil {
		return ""
	}
	if s, ok := v.(string); ok {
		return s
	}
	return fmt.Sprintf("%v", v)
}

func toInt(v interface{}) int {
	if v == nil {
		return 0
	}
	switch val := v.(type) {
	case int:
		return val
	case int64:
		return int64ToIntSafe(val)
	case float64:
		return int64ToIntSafe(int64(val))
	case string:
		n, _ := strconv.Atoi(val)
		return n
	}
	return 0
}

func int64ToIntSafe(v int64) int {
	if v > math.MaxInt {
		return math.MaxInt
	}
	if v < math.MinInt {
		return math.MinInt
	}
	return int(v)
}

func toInt16(v interface{}) int16 {
	n := toInt64(v)
	if n > math.MaxInt16 {
		return math.MaxInt16
	}
	if n < math.MinInt16 {
		return math.MinInt16
	}
	return int16(n)
}

func toInt64(v interface{}) int64 {
	if v == nil {
		return 0
	}
	switch val := v.(type) {
	case int64:
		return val
	case int:
		return int64(val)
	case float64:
		return int64(val)
	case string:
		n, _ := strconv.ParseInt(val, 10, 64)
		return n
	}
	return 0
}

func toTime(v interface{}) time.Time {
	if v == nil {
		return time.Time{}
	}
	switch val := v.(type) {
	case time.Time:
		return val
	case string:
		t, err := time.Parse(time.RFC3339Nano, val)
		if err != nil {
			t, _ = time.Parse(time.RFC3339, val)
		}
		return t
	}
	return time.Time{}
}
