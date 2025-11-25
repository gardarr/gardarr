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
	"sync"
	"time"

	"github.com/jfxdev/gardarr/internal/entities"
	"github.com/jfxdev/gardarr/internal/infra/database"
	"github.com/jfxdev/gardarr/internal/models"
	agentmanager "github.com/jfxdev/gardarr/internal/services/agentmanager"
	"github.com/jfxdev/gardarr/internal/services/events"
	"github.com/jfxdev/gardarr/pkg/env"
)

type Service struct {
	db            *database.Database
	agents        *agentmanager.Service
	eventService  *events.Service
	baseDir       string
	interval      time.Duration
	enabled       bool
	retentionDays int
	purgeInterval time.Duration
}

// NewService creates a new statistics Service using the provided database,
// agent manager and event service. Configuration such as base directory,
// interval and enabled flag are loaded from environment variables.
func NewService(db *database.Database, agents *agentmanager.Service, eventService *events.Service) *Service {
	return &Service{
		db:            db,
		agents:        agents,
		eventService:  eventService,
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

func (s *Service) Enabled() bool {
	return s.enabled
}

// collectOnce collects a snapshot of task statistics for all active agents and
// writes them to a per-agent daily file. It also updates index and hourly
// summary entries in the database.
func (s *Service) collectOnce(ctx context.Context) {
	agents, err := s.agents.ListAgents()
	if err != nil || len(agents) == 0 {
		return
	}

	// Capture timestamp once for all agents to ensure consistency
	now := time.Now().UTC()

	// Filter active agents
	var activeAgents []*entities.Agent
	for _, a := range agents {
		if a.Status == entities.AgentStatusActive {
			activeAgents = append(activeAgents, a)
		}
	}

	if len(activeAgents) == 0 {
		return
	}

	// Process agents concurrently
	var wg sync.WaitGroup
	for _, agent := range activeAgents {
		wg.Add(1)
		go func(a *entities.Agent) {
			defer wg.Done()
			s.collectAgentData(ctx, a, now)
		}(agent)
	}

	wg.Wait()
}

// collectAgentData collects statistics for a single agent
func (s *Service) collectAgentData(ctx context.Context, a *entities.Agent, now time.Time) {
	// Get tasks for this agent only
	result, err := s.agents.ListTasks(ctx, []*entities.Agent{a})
	if err != nil {
		return
	}
	tasks := result.Tasks
	if len(tasks) == 0 {
		return
	}

	// Track task state changes for events
	if s.eventService != nil {
		_ = s.eventService.TrackTasks(ctx, tasks, a.UUID, now)
		_ = s.eventService.DetectRemovedTasks(ctx, tasks, a.UUID, now)
	}

	// Open writer per agent/day
	var fw FileWriter
	if err := fw.OpenDaily(s.baseDir, a.UUID.String(), now); err != nil {
		return
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

// upsertFileIndex records or updates the file index entry for the given agent,
// date and hour, tracking file path, line count, size and time range covered by
// the snapshot file.
func (s *Service) upsertFileIndex(ctx context.Context, agentID string, ts time.Time, path string, lines int64, size int64) error {
	// Guard against nil DB to avoid panics in tests or FS-only contexts
	if s == nil || s.db == nil || s.db.DB == nil {
		return nil
	}
	date := ts.Format("2006-01-02")
	hour := ts.Hour()
	var idx models.StatsFileIndex
	tx := s.db.DB.WithContext(ctx)
	// Try to find by file_path first (unique constraint)
	err := tx.Where("file_path = ?", path).First(&idx).Error
	if err == nil {
		// Record exists, update it
		idx.LineCount += int(lines)
		idx.SizeBytes += size
		idx.EndTS = ts
		return tx.Save(&idx).Error
	}
	// Record doesn't exist, create a new one
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
	// Guard against nil DB to avoid panics in tests or FS-only contexts
	if s == nil || s.db == nil || s.db.DB == nil {
		return nil
	}
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

// calculateIncrementalAverage computes a new average using the incremental
// averaging formula: new_avg = (old_avg * (n-1) + new_value) / n
// For the first value (count == 1), it simply returns the new value.
func calculateIncrementalAverage(currentAvg int64, count int64, newValue int64) int64 {
	if count == 1 {
		return newValue
	}
	return int64((float64(currentAvg)*(float64(count)-1) + float64(newValue)) / float64(count))
}

// calculateWeightedAverage computes a weighted average of two values using their weights.
// Formula: weighted_avg = (value1 * weight1 + value2 * weight2) / (weight1 + weight2)
func calculateWeightedAverage(value1, weight1, value2, weight2 int64) int64 {
	totalWeight := weight1 + weight2
	if totalWeight == 0 {
		return 0
	}
	return int64((float64(value1)*float64(weight1) + float64(value2)*float64(weight2)) / float64(totalWeight))
}

// updateAggregation applies a snapshot line to an existing aggregation,
// updating all metrics according to their aggregation strategy (max, average, or sum)
func updateAggregation(a WindowedAggregation, sl *SnapshotLine) WindowedAggregation {
	a.Snaps++

	// DlKB and UlKB should use the maximum value in the window, not sum
	if int64(sl.DlKB) > a.DlKB {
		a.DlKB = int64(sl.DlKB)
	}
	if int64(sl.UlKB) > a.UlKB {
		a.UlKB = int64(sl.UlKB)
	}

	// Seeders and Leechers should be averaged, not summed
	a.Seeders = calculateIncrementalAverage(a.Seeders, a.Snaps, int64(sl.Sd))
	a.Leechers = calculateIncrementalAverage(a.Leechers, a.Snaps, int64(sl.Lc))

	// TotalDlB and TotalUlB are absolute cumulative values, so use max instead of sum
	if sl.DlB > a.TotalDlB {
		a.TotalDlB = sl.DlB
	}
	if sl.UlB > a.TotalUlB {
		a.TotalUlB = sl.UlB
	}

	a.SumR1e4 += int64(sl.R1e4)
	if a.Snaps > 0 {
		a.AvgRatio = (float64(a.SumR1e4) / 10000.0) / float64(a.Snaps)
	}

	return a
}

// mergeAggregations combines two WindowedAggregation structures by applying appropriate
// merging strategies for each metric: max for speeds and cumulative values, weighted
// average for seeders/leechers, and sum for ratio components
func mergeAggregations(a1, a2 WindowedAggregation) WindowedAggregation {
	totalSnaps := a1.Snaps + a2.Snaps

	result := WindowedAggregation{
		Snaps: totalSnaps,
	}

	// Use max for speed metrics
	if a1.DlKB > a2.DlKB {
		result.DlKB = a1.DlKB
	} else {
		result.DlKB = a2.DlKB
	}

	if a1.UlKB > a2.UlKB {
		result.UlKB = a1.UlKB
	} else {
		result.UlKB = a2.UlKB
	}

	// Weighted average for seeders and leechers
	result.Seeders = calculateWeightedAverage(a1.Seeders, a1.Snaps, a2.Seeders, a2.Snaps)
	result.Leechers = calculateWeightedAverage(a1.Leechers, a1.Snaps, a2.Leechers, a2.Snaps)

	// Use max for cumulative byte values
	if a1.TotalDlB > a2.TotalDlB {
		result.TotalDlB = a1.TotalDlB
	} else {
		result.TotalDlB = a2.TotalDlB
	}

	if a1.TotalUlB > a2.TotalUlB {
		result.TotalUlB = a1.TotalUlB
	} else {
		result.TotalUlB = a2.TotalUlB
	}

	// Sum the ratio components and recalculate average
	result.SumR1e4 = a1.SumR1e4 + a2.SumR1e4
	if totalSnaps > 0 {
		result.AvgRatio = (float64(result.SumR1e4) / 10000.0) / float64(totalSnaps)
	}

	return result
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

	// Build list of dates to check
	var dates []time.Time
	cur := from.UTC().Truncate(24 * time.Hour)
	end := to.UTC().Truncate(24 * time.Hour)
	for !cur.After(end) {
		dates = append(dates, cur)
		cur = cur.Add(24 * time.Hour)
	}

	// Process dates concurrently with worker pool
	type dateResult struct {
		path string
	}

	resultsChan := make(chan dateResult, len(dates))
	var wg sync.WaitGroup

	// Use worker pool to limit concurrent file system operations
	// Too many concurrent stats can overwhelm the filesystem
	workers := 16
	if len(dates) < workers {
		workers = len(dates)
	}
	if workers == 0 {
		workers = 1
	}

	dateChan := make(chan time.Time, len(dates))
	for _, d := range dates {
		dateChan <- d
	}
	close(dateChan)

	// Start workers
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for date := range dateChan {
				yyyy := date.Format("2006")
				mm := date.Format("01")
				day := date.Format("2006-01-02")
				candidates := []string{
					filepath.Join(base, yyyy, mm, agentID, agentID+"-"+day+".jsonl.gz"),
					filepath.Join(base, "statistics", yyyy, mm, agentID, agentID+"-"+day+".jsonl.gz"),
				}
				for _, p := range candidates {
					if _, err := os.Stat(p); err == nil {
						resultsChan <- dateResult{path: p}
						break
					}
				}
			}
		}()
	}

	// Close results channel when all workers complete
	go func() {
		wg.Wait()
		close(resultsChan)
	}()

	// Collect results
	var files []string
	for result := range resultsChan {
		files = append(files, result.path)
	}

	// Fallback: walk and find matching files if structured search found nothing
	if len(files) == 0 {
		var mu sync.Mutex
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
						mu.Lock()
						files = append(files, path)
						mu.Unlock()
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
// filterTasks can be empty, a single task hash, or multiple task hashes
func (s *Service) GetWindowedAggregation(ctx context.Context, agentID string, from, to time.Time, step time.Duration, groupBy string, filterTasks []string) (interface{}, error) {
	files, err := s.DiscoverFiles(ctx, agentID, from, to)
	if err != nil {
		return nil, err
	}

	if groupBy == "task" {
		return s.aggregateByTask(files, from, to, step, filterTasks)
	}

	return s.aggregateByAgent(files, from, to, step, filterTasks)
}

// aggregateByTask aggregates statistics grouped by task
// filterTasks is a list of task hashes to filter by. Empty list means no filter.
func (s *Service) aggregateByTask(files []string, from, to time.Time, step time.Duration, filterTasks []string) (map[string]map[string]WindowedAggregation, error) {
	// Create a map for O(1) lookup if filtering
	filterMap := make(map[string]bool)
	for _, task := range filterTasks {
		if task != "" {
			filterMap[task] = true
		}
	}
	type fileResult struct {
		data map[string]map[string]WindowedAggregation
	}

	resultsChan := make(chan fileResult, len(files))
	var wg sync.WaitGroup

	// Process each file concurrently
	for _, filePath := range files {
		wg.Add(1)
		go func(p string) {
			defer wg.Done()

			localData := make(map[string]map[string]WindowedAggregation)

			_ = s.ScanFile(p, func(sl *SnapshotLine) {
				ts := sl.TS.UTC()
				if ts.Before(from.UTC()) || ts.After(to.UTC()) {
					return
				}
				// Filter by task hashes if specified
				if len(filterMap) > 0 && !filterMap[sl.Task] {
					return
				}

				w := ts.Truncate(step)
				wk := w.Format(time.RFC3339)

				if _, ok := localData[wk]; !ok {
					localData[wk] = map[string]WindowedAggregation{}
				}

				a := localData[wk][sl.Task]
				a = updateAggregation(a, sl)
				localData[wk][sl.Task] = a
			})

			resultsChan <- fileResult{data: localData}
		}(filePath)
	}

	// Close channel when all goroutines complete
	go func() {
		wg.Wait()
		close(resultsChan)
	}()

	// Merge results from all files
	out := make(map[string]map[string]WindowedAggregation)
	for result := range resultsChan {
		for wk, tasks := range result.data {
			if _, ok := out[wk]; !ok {
				out[wk] = map[string]WindowedAggregation{}
			}
			for task, agg := range tasks {
				if existing, ok := out[wk][task]; ok {
					out[wk][task] = mergeAggregations(existing, agg)
				} else {
					out[wk][task] = agg
				}
			}
		}
	}

	return out, nil
}

// aggregateByAgent aggregates statistics for the entire agent
// filterTasks is a list of task hashes to filter by. Empty list means no filter.
func (s *Service) aggregateByAgent(files []string, from, to time.Time, step time.Duration, filterTasks []string) (map[string]WindowedAggregation, error) {
	// Create a map for O(1) lookup if filtering
	filterMap := make(map[string]bool)
	for _, task := range filterTasks {
		if task != "" {
			filterMap[task] = true
		}
	}
	type fileResult struct {
		timestampAggs map[time.Time]*WindowedAggregation
	}

	resultsChan := make(chan fileResult, len(files))
	var wg sync.WaitGroup

	// First pass: process files concurrently to build timestamp aggregations
	for _, filePath := range files {
		wg.Add(1)
		go func(p string) {
			defer wg.Done()

			localTimestampAggs := make(map[time.Time]*WindowedAggregation)

			_ = s.ScanFile(p, func(sl *SnapshotLine) {
				ts := sl.TS.UTC()
				if ts.Before(from.UTC()) || ts.After(to.UTC()) {
					return
				}
				// Filter by task hashes if specified
				if len(filterMap) > 0 && !filterMap[sl.Task] {
					return
				}

				// Group by exact timestamp to sum concurrent torrents
				tsKey := ts.Truncate(time.Second)
				if localTimestampAggs[tsKey] == nil {
					localTimestampAggs[tsKey] = &WindowedAggregation{}
				}

				a := localTimestampAggs[tsKey]
				a.Snaps++

				// Sum speeds for concurrent torrents at this timestamp
				a.DlKB += int64(sl.DlKB)
				a.UlKB += int64(sl.UlKB)

				// Other metrics use incremental average (seeders/leechers) or sum (ratio)
				a.Seeders = calculateIncrementalAverage(a.Seeders, a.Snaps, int64(sl.Sd))
				a.Leechers = calculateIncrementalAverage(a.Leechers, a.Snaps, int64(sl.Lc))

				// TotalDlB and TotalUlB use max (cumulative values)
				if sl.DlB > a.TotalDlB {
					a.TotalDlB = sl.DlB
				}
				if sl.UlB > a.TotalUlB {
					a.TotalUlB = sl.UlB
				}

				a.SumR1e4 += int64(sl.R1e4)
				if a.Snaps > 0 {
					a.AvgRatio = (float64(a.SumR1e4) / 10000.0) / float64(a.Snaps)
				}
			})

			resultsChan <- fileResult{timestampAggs: localTimestampAggs}
		}(filePath)
	}

	// Close channel when all goroutines complete
	go func() {
		wg.Wait()
		close(resultsChan)
	}()

	// Merge timestamp aggregations from all files
	timestampAggs := make(map[time.Time]*WindowedAggregation)
	for result := range resultsChan {
		for ts, tsAgg := range result.timestampAggs {
			if existing, ok := timestampAggs[ts]; ok {
				// Merge two timestamp aggregations
				existing.Snaps += tsAgg.Snaps
				existing.DlKB += tsAgg.DlKB
				existing.UlKB += tsAgg.UlKB
				existing.Seeders = calculateWeightedAverage(existing.Seeders, existing.Snaps-tsAgg.Snaps, tsAgg.Seeders, tsAgg.Snaps)
				existing.Leechers = calculateWeightedAverage(existing.Leechers, existing.Snaps-tsAgg.Snaps, tsAgg.Leechers, tsAgg.Snaps)
				if tsAgg.TotalDlB > existing.TotalDlB {
					existing.TotalDlB = tsAgg.TotalDlB
				}
				if tsAgg.TotalUlB > existing.TotalUlB {
					existing.TotalUlB = tsAgg.TotalUlB
				}
				existing.SumR1e4 += tsAgg.SumR1e4
				existing.AvgRatio = (float64(existing.SumR1e4) / 10000.0) / float64(existing.Snaps)
			} else {
				timestampAggs[ts] = tsAgg
			}
		}
	}

	// Second pass: aggregate timestamp-level sums into windows (take max per window)
	out := make(map[string]WindowedAggregation)
	for ts, tsAgg := range timestampAggs {
		w := ts.Truncate(step)
		wk := w.Format(time.RFC3339)

		windowAgg := out[wk]
		if windowAgg.Snaps == 0 {
			windowAgg = *tsAgg
		} else {
			// Merge timestamp aggregation into window
			// For speeds: take max of timestamp sums (peak concurrent throughput)
			if tsAgg.DlKB > windowAgg.DlKB {
				windowAgg.DlKB = tsAgg.DlKB
			}
			if tsAgg.UlKB > windowAgg.UlKB {
				windowAgg.UlKB = tsAgg.UlKB
			}
			// For other metrics: aggregate appropriately
			totalSnaps := windowAgg.Snaps + tsAgg.Snaps
			// Weighted average for seeders/leechers when merging timestamp aggregations
			windowAgg.Seeders = calculateWeightedAverage(windowAgg.Seeders, windowAgg.Snaps, tsAgg.Seeders, tsAgg.Snaps)
			windowAgg.Leechers = calculateWeightedAverage(windowAgg.Leechers, windowAgg.Snaps, tsAgg.Leechers, tsAgg.Snaps)
			if tsAgg.TotalDlB > windowAgg.TotalDlB {
				windowAgg.TotalDlB = tsAgg.TotalDlB
			}
			if tsAgg.TotalUlB > windowAgg.TotalUlB {
				windowAgg.TotalUlB = tsAgg.TotalUlB
			}
			windowAgg.SumR1e4 += tsAgg.SumR1e4
			windowAgg.Snaps = totalSnaps
			windowAgg.AvgRatio = (float64(windowAgg.SumR1e4) / 10000.0) / float64(windowAgg.Snaps)
		}
		out[wk] = windowAgg
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

	type taskWindowEntry struct {
		window   string
		task     string
		firstUlB int64
		firstTS  time.Time
		lastUlB  int64
		lastTS   time.Time
	}

	type fileResult struct {
		entries map[string]map[string]*taskWindowEntry // task -> window -> entry
	}

	resultsChan := make(chan fileResult, len(files))
	var wg sync.WaitGroup

	// Process each file concurrently
	for _, filePath := range files {
		wg.Add(1)
		go func(p string) {
			defer wg.Done()

			localEntries := make(map[string]map[string]*taskWindowEntry)

			_ = s.ScanFile(p, func(sl *SnapshotLine) {
				ts := sl.TS.UTC()
				if ts.Before(from.UTC()) || ts.After(to.UTC()) {
					return
				}

				w := ts.Truncate(step)
				wk := w.Format(time.RFC3339)

				if localEntries[sl.Task] == nil {
					localEntries[sl.Task] = make(map[string]*taskWindowEntry)
				}
				if localEntries[sl.Task][wk] == nil {
					localEntries[sl.Task][wk] = &taskWindowEntry{
						window:   wk,
						task:     sl.Task,
						firstUlB: sl.UlB,
						firstTS:  ts,
						lastUlB:  sl.UlB,
						lastTS:   ts,
					}
				} else {
					entry := localEntries[sl.Task][wk]
					// Update first if this timestamp is earlier
					if ts.Before(entry.firstTS) {
						entry.firstUlB = sl.UlB
						entry.firstTS = ts
					}
					// Update last if this timestamp is later
					if ts.After(entry.lastTS) {
						entry.lastUlB = sl.UlB
						entry.lastTS = ts
					}
				}
			})

			resultsChan <- fileResult{entries: localEntries}
		}(filePath)
	}

	// Close channel when all goroutines complete
	go func() {
		wg.Wait()
		close(resultsChan)
	}()

	// Merge results from all files
	taskWindows := make(map[string]map[string]*taskWindowEntry)
	for result := range resultsChan {
		for task, windowMap := range result.entries {
			if taskWindows[task] == nil {
				taskWindows[task] = make(map[string]*taskWindowEntry)
			}
			for window, entry := range windowMap {
				if existing, ok := taskWindows[task][window]; ok {
					// Merge entries: keep earliest first and latest last
					if entry.firstTS.Before(existing.firstTS) {
						existing.firstUlB = entry.firstUlB
						existing.firstTS = entry.firstTS
					}
					if entry.lastTS.After(existing.lastTS) {
						existing.lastUlB = entry.lastUlB
						existing.lastTS = entry.lastTS
					}
				} else {
					taskWindows[task][window] = entry
				}
			}
		}
	}

	// Calculate differences and collect results (ensure non-nil slice)
	results := make([]TaskUploadDiff, 0)
	for _, taskMap := range taskWindows {
		for _, entry := range taskMap {
			diff := entry.lastUlB - entry.firstUlB
			if diff > 0 {
				results = append(results, TaskUploadDiff{
					Window:   entry.window,
					Task:     entry.task,
					FirstUlB: entry.firstUlB,
					LastUlB:  entry.lastUlB,
					Diff:     diff,
				})
			}
		}
	}

	// Sort by difference (descending) and limit
	sort.Slice(results, func(i, j int) bool {
		return results[i].Diff > results[j].Diff
	})

	if limit > 0 && len(results) > limit {
		results = results[:limit]
	}

	return results, nil
}
