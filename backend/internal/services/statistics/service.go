package statistics

import (
	"bufio"
	"compress/gzip"
	"context"
	"encoding/json"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"time"

	"github.com/gardarr/gardarr/internal/entities"
	"github.com/gardarr/gardarr/internal/infra/database"
	"github.com/gardarr/gardarr/internal/models"
	agentmanager "github.com/gardarr/gardarr/internal/services/agentmanager"
	"github.com/gardarr/gardarr/pkg/env"
)

type Service struct {
	db            *database.Database
	agents        *agentmanager.Service
	baseDir       string
	interval      time.Duration
	enabled       bool
	retentionDays int
	purgeInterval time.Duration
}

// NewService creates a new statistics Service using the provided database and
// agent manager. Configuration such as base directory, interval and enabled
// flag are loaded from environment variables.
func NewService(db *database.Database, agents *agentmanager.Service) *Service {
	return &Service{
		db:            db,
		agents:        agents,
		baseDir:       env.Get("STATISTICS_DIR").Default("./data/statistics").Value(),
		interval:      env.Get("STATISTICS_INTERVAL").Default("30s").ValueDuration(),
		enabled:       env.Get("STATISTICS_ENABLED").Default(true).ValueBool(),
		retentionDays: env.Get("STATISTICS_RETENTION_DAYS").Default(0).ValueInt(),
		purgeInterval: env.Get("STATISTICS_PURGE_INTERVAL").Default("30m").ValueDuration(),
	}
}

// Start begins the periodic statistics collection loop if the service is
// enabled. It schedules collection at the configured interval and stops when
// the provided context is canceled.
func (s *Service) Start(ctx context.Context) {
	if !s.enabled {
		return
	}
	ticker := time.NewTicker(s.interval)
	var purgeTicker *time.Ticker
	if s.retentionDays > 0 {
		if s.purgeInterval <= 0 {
			s.purgeInterval = time.Hour
		}
		purgeTicker = time.NewTicker(s.purgeInterval)
	}
	go func() {
		defer ticker.Stop()
		if purgeTicker != nil {
			defer purgeTicker.Stop()
		}
		for {
			select {
			case <-ticker.C:
				s.collectOnce(ctx)
			case <-func() <-chan time.Time {
				if purgeTicker != nil {
					return purgeTicker.C
				}
				// create a nil channel that never fires when purge disabled
				return make(<-chan time.Time)
			}():
				_ = s.PurgeOldFiles(ctx)
			case <-ctx.Done():
				return
			}
		}
	}()
}

// collectOnce collects a snapshot of task statistics for all active agents and
// writes them to a per-agent daily file. It also updates index and hourly
// summary entries in the database.
func (s *Service) collectOnce(ctx context.Context) {
	agents, err := s.agents.ListAgents()
	if err != nil || len(agents) == 0 {
		return
	}

	now := time.Now().UTC()
	for _, a := range agents {
		if a.Status != entities.AgentStatusActive {
			continue
		}

		// Get tasks for this agent only
		tasks, _ := s.agents.ListTasks([]*entities.Agent{a})
		if len(tasks) == 0 {
			continue
		}

		// Open writer per agent/day
		var fw FileWriter
		if err := fw.OpenDaily(s.baseDir, a.UUID.String(), now); err != nil {
			continue
		}

		// Build and write lines
		var tasksSeen, dlActive, ulActive int
		var totalDlKBs, totalUlKBs int64
		for _, t := range tasks {
			line := SnapshotLine{
				TS:   now,
				Task: t.Hash,
				St:   t.State,
				P01:  int(t.Progress * 100.0),
				R1e4: int(t.Ratio * 10000.0),
				DlKB: t.Network.Download.Speed / 1024,
				UlKB: t.Network.Upload.Speed / 1024,
				Sd:   int16(t.Pairs.Seeders),
				Lc:   int16(t.Pairs.Leechers),
				DlB:  int64(t.Network.Download.Amount),
				UlB:  int64(t.Network.Upload.Amount),
			}
			_ = fw.WriteLine(line)

			tasksSeen++
			if line.DlKB > 0 {
				dlActive++
			}
			if line.UlKB > 0 {
				ulActive++
			}
			totalDlKBs += int64(line.DlKB)
			totalUlKBs += int64(line.UlKB)
		}
		_ = fw.Flush()
		_ = fw.Close()

		// Upsert file index for current hour
		_ = s.upsertFileIndex(ctx, a.UUID.String(), now, fw.Path(), fw.Lines(), fw.Size())
		_ = s.upsertHourSummary(ctx, a.UUID.String(), now, fw.Path(), tasksSeen, dlActive, ulActive, totalDlKBs, totalUlKBs)
	}
}

// upsertFileIndex records or updates the file index entry for the given agent,
// date and hour, tracking file path, line count, size and time range covered by
// the snapshot file.
func (s *Service) upsertFileIndex(ctx context.Context, agentID string, ts time.Time, path string, lines int64, size int64) error {
	date := ts.Format("2006-01-02")
	hour := ts.Hour()
	var idx models.StatsFileIndex
	tx := s.db.DB.WithContext(ctx)
	// unique per agent/date/hour
	if err := tx.Where("agent_id = ? AND date = ? AND hour = ?", agentID, date, hour).First(&idx).Error; err == nil {
		idx.FilePath = path
		idx.LineCount += int(lines)
		idx.SizeBytes += size
		idx.EndTS = ts
		return tx.Save(&idx).Error
	}
	idx = models.StatsFileIndex{
		AgentID:   agentID,
		Date:      date,
		Hour:      hour,
		FilePath:  path,
		StartTS:   ts,
		EndTS:     ts,
		LineCount: int(lines),
		SizeBytes: size,
	}
	return tx.Create(&idx).Error
}

// upsertHourSummary records or updates aggregated hourly statistics for the
// given agent, including number of tasks seen, counts of active download/upload
// tasks and total transfer speeds in KB/s.
func (s *Service) upsertHourSummary(ctx context.Context, agentID string, ts time.Time, path string, tasksSeen, dlActive, ulActive int, totalDlKBs, totalUlKBs int64) error {
	date := ts.Format("2006-01-02")
	hour := ts.Hour()
	var sum models.StatsFileHourSummary
	tx := s.db.DB.WithContext(ctx)
	if err := tx.Where("agent_id = ? AND date = ? AND hour = ?", agentID, date, hour).First(&sum).Error; err == nil {
		sum.TasksSeen += tasksSeen
		sum.ActiveDlCount += dlActive
		sum.ActiveUlCount += ulActive
		sum.TotalDlKBs += totalDlKBs
		sum.TotalUlKBs += totalUlKBs
		return tx.Save(&sum).Error
	}
	sum = models.StatsFileHourSummary{
		AgentID:       agentID,
		Date:          date,
		Hour:          hour,
		TasksSeen:     tasksSeen,
		ActiveDlCount: dlActive,
		ActiveUlCount: ulActive,
		TotalDlKBs:    totalDlKBs,
		TotalUlKBs:    totalUlKBs,
	}
	return tx.Create(&sum).Error
}

// ParseTime parses a timestamp string supporting multiple formats
func ParseTime(s string) (time.Time, error) {
	layouts := []string{time.RFC3339, "2006-01-02 15:04:05", "2006-01-02"}
	for _, l := range layouts {
		if t, e := time.Parse(l, s); e == nil {
			return t, nil
		}
	}
	return time.Time{}, fmt.Errorf("invalid time format")
}

// DiscoverFiles finds statistics files for an agent within a date range
func (s *Service) DiscoverFiles(ctx context.Context, agentID string, from, to time.Time) ([]string, error) {
	fromDate := from.UTC().Format("2006-01-02")
	toDate := to.UTC().Format("2006-01-02")

	// Try to get files from database index
	var idx []models.StatsFileIndex
	// Guard against nil DB in tests or FS-only contexts
	if s != nil && s.db != nil && s.db.DB != nil {
		if err := s.db.DB.WithContext(ctx).
			Where("agent_id = ? AND date >= ? AND date <= ?", agentID, fromDate, toDate).
			Find(&idx).Error; err != nil {
			return nil, fmt.Errorf("failed to query file index: %w", err)
		}
	}

	fileSet := make(map[string]struct{})
	for _, r := range idx {
		if r.FilePath != "" {
			fileSet[r.FilePath] = struct{}{}
		}
	}

	files := make([]string, 0, len(fileSet))
	for p := range fileSet {
		files = append(files, p)
	}

	// If no files from index, discover from filesystem
	if len(files) == 0 {
		files = s.discoverFilesFromFS(agentID, from, to, fromDate, toDate)
	}

	sort.Strings(files)
	return files, nil
}

// discoverFilesFromFS discovers statistics files directly from the filesystem
func (s *Service) discoverFilesFromFS(agentID string, from, to time.Time, fromDate, toDate string) []string {
	base := s.baseDir
	if _, err := os.Stat(base); err != nil {
		if _, err2 := os.Stat("./data"); err2 == nil {
			base = "./data"
		}
	}

	var files []string

	// Try structured path first
	cur := from.UTC().Truncate(24 * time.Hour)
	end := to.UTC().Truncate(24 * time.Hour)
	for !cur.After(end) {
		yyyy := cur.Format("2006")
		mm := cur.Format("01")
		day := cur.Format("2006-01-02")
		candidates := []string{
			filepath.Join(base, yyyy, mm, agentID, agentID+"-"+day+".jsonl.gz"),
			filepath.Join(base, "statistics", yyyy, mm, agentID, agentID+"-"+day+".jsonl.gz"),
		}
		for _, p := range candidates {
			if _, err := os.Stat(p); err == nil {
				files = append(files, p)
				break
			}
		}
		cur = cur.Add(24 * time.Hour)
	}

	// Fallback: walk and find matching files
	if len(files) == 0 {
		_ = filepath.Walk(base, func(path string, info os.FileInfo, err error) error {
			if err != nil || info == nil || info.IsDir() {
				return nil
			}
			name := info.Name()
			if len(name) > len(agentID)+1 && name[:len(agentID)+1] == agentID+"-" && filepath.Ext(name) == ".gz" {
				rest := name[len(agentID)+1:]
				if len(rest) >= 10 {
					d := rest[:10]
					if d >= fromDate && d <= toDate {
						files = append(files, path)
					}
				}
			}
			return nil
		})
	}

	return files
}

// ScanFile reads a gzip JSONL file and calls fn for each parsed SnapshotLine
func (s *Service) ScanFile(path string, fn func(*SnapshotLine)) error {
	if path == "" {
		return nil
	}

	p := path
	if !filepath.IsAbs(p) {
		if abs, err := filepath.Abs(p); err == nil {
			p = abs
		}
	}

	f, err := os.Open(p)
	if err != nil {
		return err
	}
	defer f.Close()

	gz, err := gzip.NewReader(f)
	if err != nil {
		return err
	}
	defer gz.Close()

	scanner := bufio.NewScanner(gz)
	scanner.Buffer(make([]byte, 0, 64*1024), 10*1024*1024)

	for scanner.Scan() {
		var sl SnapshotLine
		if err := json.Unmarshal(scanner.Bytes(), &sl); err == nil {
			fn(&sl)
		}
	}

	return scanner.Err()
}

// PurgeOldFiles deletes statistics files and database indices older than the configured retention
// period. If retention is disabled (<=0), this is a no-op. The purge consists of:
// 1) Deleting DB rows in StatsFileHourSummary and StatsFileIndex older than cutoff date
// 2) Deleting .jsonl.gz files under the base statistics directory older than cutoff date
func (s *Service) PurgeOldFiles(ctx context.Context) error {
	if s.retentionDays <= 0 {
		return nil
	}

	cutoff := time.Now().UTC().AddDate(0, 0, -s.retentionDays)
	cutoffDate := cutoff.Format("2006-01-02")

	// DB purge (guard for nil DB in tests)
	if s.db != nil && s.db.DB != nil {
		if err := s.db.DB.WithContext(ctx).
			Where("date < ?", cutoffDate).
			Delete(&models.StatsFileHourSummary{}).Error; err != nil {
			return fmt.Errorf("purge hour summaries: %w", err)
		}
		if err := s.db.DB.WithContext(ctx).
			Where("date < ?", cutoffDate).
			Delete(&models.StatsFileIndex{}).Error; err != nil {
			return fmt.Errorf("purge file index: %w", err)
		}
	}

	// FS purge
	base := s.baseDir
	if _, err := os.Stat(base); err != nil {
		if _, err2 := os.Stat("./data"); err2 == nil {
			base = "./data"
		}
	}

	_ = filepath.WalkDir(base, func(path string, d fs.DirEntry, err error) error {
		if err != nil || d == nil || d.IsDir() {
			return nil
		}
		if filepath.Ext(path) != ".gz" {
			return nil
		}

		name := d.Name()
		var dateStr string
		// scan for YYYY-MM-DD in file name
		for i := 0; i+10 <= len(name); i++ {
			seg := name[i : i+10]
			if len(seg) == 10 && seg[4] == '-' && seg[7] == '-' {
				dateStr = seg
				break
			}
		}
		if dateStr == "" {
			return nil
		}
		if dateStr < cutoffDate {
			_ = os.Remove(path)
		}
		return nil
	})

	return nil
}

// GetTotalSize walks the statistics base directory and returns the total size
// in bytes of all .jsonl.gz files. If the base directory does not exist, it
// returns 0 without error.
func (s *Service) GetTotalSize(ctx context.Context) (int64, error) {
	base := s.baseDir
	if _, err := os.Stat(base); err != nil {
		if _, err2 := os.Stat("./data"); err2 == nil {
			base = "./data"
		} else {
			// no base dir found
			return 0, nil
		}
	}
	var total int64
	err := filepath.WalkDir(base, func(path string, d fs.DirEntry, err error) error {
		if err != nil || d == nil || d.IsDir() {
			return nil
		}
		if filepath.Ext(path) != ".gz" {
			return nil
		}
		info, e := d.Info()
		if e != nil {
			return nil
		}
		total += info.Size()
		return nil
	})
	if err != nil {
		return 0, err
	}
	return total, nil
}

// WindowedAggregation represents aggregated statistics in a time window
type WindowedAggregation struct {
	Snaps    int64   `json:"snaps"`
	DlKB     int64   `json:"dl_kb"`
	UlKB     int64   `json:"ul_kb"`
	Seeders  int64   `json:"seeders"`
	Leechers int64   `json:"leechers"`
	TotalDlB int64   `json:"total_dl_bytes"`
	TotalUlB int64   `json:"total_ul_bytes"`
	SumR1e4  int64   `json:"sum_r1e4"`
	AvgRatio float64 `json:"avg_ratio"`
}

// GetWindowedAggregation computes aggregated statistics in fixed time windows
func (s *Service) GetWindowedAggregation(ctx context.Context, agentID string, from, to time.Time, step time.Duration, groupBy, filterTask string) (interface{}, error) {
	files, err := s.DiscoverFiles(ctx, agentID, from, to)
	if err != nil {
		return nil, err
	}

	if groupBy == "task" {
		return s.aggregateByTask(files, from, to, step, filterTask)
	}

	return s.aggregateByAgent(files, from, to, step, filterTask)
}

// aggregateByTask aggregates statistics grouped by task
func (s *Service) aggregateByTask(files []string, from, to time.Time, step time.Duration, filterTask string) (map[string]map[string]WindowedAggregation, error) {
	out := make(map[string]map[string]WindowedAggregation)

	for _, p := range files {
		_ = s.ScanFile(p, func(sl *SnapshotLine) {
			ts := sl.TS.UTC()
			if ts.Before(from.UTC()) || ts.After(to.UTC()) {
				return
			}
			if filterTask != "" && sl.Task != filterTask {
				return
			}

			w := ts.Truncate(step)
			wk := w.Format(time.RFC3339)

			if _, ok := out[wk]; !ok {
				out[wk] = map[string]WindowedAggregation{}
			}

			a := out[wk][sl.Task]
			a.Snaps++
			a.DlKB += int64(sl.DlKB)
			a.UlKB += int64(sl.UlKB)
			a.Seeders += int64(sl.Sd)
			a.Leechers += int64(sl.Lc)
			a.TotalDlB += sl.DlB
			a.TotalUlB += sl.UlB
			a.SumR1e4 += int64(sl.R1e4)
			if a.Snaps > 0 {
				a.AvgRatio = (float64(a.SumR1e4) / 10000.0) / float64(a.Snaps)
			}
			out[wk][sl.Task] = a
		})
	}

	return out, nil
}

// aggregateByAgent aggregates statistics for the entire agent
func (s *Service) aggregateByAgent(files []string, from, to time.Time, step time.Duration, filterTask string) (map[string]WindowedAggregation, error) {
	out := make(map[string]WindowedAggregation)

	for _, p := range files {
		_ = s.ScanFile(p, func(sl *SnapshotLine) {
			ts := sl.TS.UTC()
			if ts.Before(from.UTC()) || ts.After(to.UTC()) {
				return
			}
			if filterTask != "" && sl.Task != filterTask {
				return
			}

			w := ts.Truncate(step)
			wk := w.Format(time.RFC3339)

			a := out[wk]
			a.Snaps++
			a.DlKB += int64(sl.DlKB)
			a.UlKB += int64(sl.UlKB)
			a.Seeders += int64(sl.Sd)
			a.Leechers += int64(sl.Lc)
			a.TotalDlB += sl.DlB
			a.TotalUlB += sl.UlB
			a.SumR1e4 += int64(sl.R1e4)
			if a.Snaps > 0 {
				a.AvgRatio = (float64(a.SumR1e4) / 10000.0) / float64(a.Snaps)
			}
			out[wk] = a
		})
	}

	return out, nil
}

// TaskUploadDiff represents upload difference data for a task in a window
type TaskUploadDiff struct {
	FirstUlB int64  `json:"first_ul_bytes"`
	LastUlB  int64  `json:"last_ul_bytes"`
	Diff     int64  `json:"diff"`
	Window   string `json:"window"`
	Task     string `json:"task"`
}

// GetUploadDiffs calculates tasks with highest upload differences per window
func (s *Service) GetUploadDiffs(ctx context.Context, agentID string, from, to time.Time, step time.Duration, limit int) ([]TaskUploadDiff, error) {
	files, err := s.DiscoverFiles(ctx, agentID, from, to)
	if err != nil {
		return nil, err
	}

	taskWindows := make(map[string]map[string]*TaskUploadDiff)

	// Scan files and collect first/last values per task per window
	for _, p := range files {
		_ = s.ScanFile(p, func(sl *SnapshotLine) {
			ts := sl.TS.UTC()
			if ts.Before(from.UTC()) || ts.After(to.UTC()) {
				return
			}

			w := ts.Truncate(step)
			wk := w.Format(time.RFC3339)

			if taskWindows[sl.Task] == nil {
				taskWindows[sl.Task] = make(map[string]*TaskUploadDiff)
			}
			if taskWindows[sl.Task][wk] == nil {
				taskWindows[sl.Task][wk] = &TaskUploadDiff{
					Window: wk,
					Task:   sl.Task,
				}
			}

			twd := taskWindows[sl.Task][wk]
			if twd.FirstUlB == 0 {
				twd.FirstUlB = sl.UlB
			}
			twd.LastUlB = sl.UlB
		})
	}

	// Calculate differences and collect results (ensure non-nil slice)
	results := make([]TaskUploadDiff, 0)
	for _, taskMap := range taskWindows {
		for _, twd := range taskMap {
			twd.Diff = twd.LastUlB - twd.FirstUlB
			if twd.Diff > 0 {
				results = append(results, *twd)
			}
		}
	}

	// Sort by difference (descending) and limit
	sort.Slice(results, func(i, j int) bool {
		return results[i].Diff > results[j].Diff
	})

	if len(results) > limit {
		results = results[:limit]
	}

	return results, nil
}
