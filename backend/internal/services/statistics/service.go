package statistics

import (
	"context"
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/jfxdev/gardarr/internal/entities"
	"github.com/jfxdev/gardarr/internal/infra/database"
	agentmanager "github.com/jfxdev/gardarr/internal/services/agentmanager"
	"github.com/jfxdev/gardarr/internal/services/events"
	"github.com/jfxdev/gardarr/pkg/env"
)

type Service struct {
	provider      StatsProvider
	agents        *agentmanager.Service
	eventService  *events.Service
	interval      time.Duration
	enabled       bool
	retentionDays int
	purgeInterval time.Duration
}

// NewService creates a new statistics Service using the provided database,
// agent manager and event service. Configuration such as base directory,
// interval and enabled flag are loaded from environment variables.
// It uses a FilesystemProvider by default for backward compatibility.
func NewService(db *database.Database, agents *agentmanager.Service, eventService *events.Service) *Service {
	return &Service{
		provider: NewFilesystemProvider(FilesystemProviderConfig{
			DB:      db,
			BaseDir: env.Get("STATISTICS_DIR").Default("./data/statistics").Value(),
		}),
		agents:        agents,
		eventService:  eventService,
		interval:      env.Get("STATISTICS_INTERVAL").Default("30s").ValueDuration(),
		enabled:       env.Get("STATISTICS_ENABLED").Default(true).ValueBool(),
		retentionDays: env.Get("STATISTICS_RETENTION_DAYS").Default(0).ValueInt(),
		purgeInterval: env.Get("STATISTICS_PURGE_INTERVAL").Default("30m").ValueDuration(),
	}
}

// NewServiceWithProvider creates a new statistics Service with a custom StatsProvider.
func NewServiceWithProvider(provider StatsProvider, agents *agentmanager.Service, eventService *events.Service) *Service {
	return &Service{
		provider:      provider,
		agents:        agents,
		eventService:  eventService,
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
				_ = s.purgeOldData(ctx)
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

	// Build snapshot lines and summary data
	var lines []SnapshotLine
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
		lines = append(lines, line)

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

	agentID := a.UUID.String()

	// Write snapshots via provider
	_ = s.provider.WriteSnapshots(ctx, agentID, now, lines)

	// Upsert hour summary via provider
	_ = s.provider.UpsertHourSummary(ctx, agentID, now, HourSummaryInput{
		TasksSeen: tasksSeen,
		DlActive:  dlActive,
		UlActive:  ulActive,
		TotalDlKB: totalDlKBs,
		TotalUlKB: totalUlKBs,
	})
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

// purgeOldData delegates purge to the provider.
func (s *Service) purgeOldData(ctx context.Context) error {
	if s.retentionDays <= 0 {
		return nil
	}
	cutoff := time.Now().UTC().AddDate(0, 0, -s.retentionDays)
	return s.provider.Purge(ctx, cutoff.Format("2006-01-02"))
}

// GetDayIndex retrieves index entries for an agent on a specific date.
func (s *Service) GetDayIndex(ctx context.Context, agentID string, date string) ([]DayIndexRow, error) {
	return s.provider.GetDayIndex(ctx, agentID, date)
}

// GetHourSummaries retrieves hourly summaries for an agent in a date range.
func (s *Service) GetHourSummaries(ctx context.Context, agentID string, fromDate, toDate string) ([]HourSummaryRow, error) {
	return s.provider.GetHourSummaries(ctx, agentID, fromDate, toDate)
}

// GetTotalSize delegates to the provider to return total storage size.
func (s *Service) GetTotalSize(ctx context.Context) (int64, error) {
	return s.provider.GetTotalSize(ctx)
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
	if groupBy == "task" {
		return s.aggregateByTask(ctx, agentID, from, to, step, filterTasks)
	}

	return s.aggregateByAgent(ctx, agentID, from, to, step, filterTasks)
}

// aggregateByTask aggregates statistics grouped by task
// filterTasks is a list of task hashes to filter by. Empty list means no filter.
func (s *Service) aggregateByTask(ctx context.Context, agentID string, from, to time.Time, step time.Duration, filterTasks []string) (map[string]map[string]WindowedAggregation, error) {
	filterMap := make(map[string]bool)
	for _, task := range filterTasks {
		if task != "" {
			filterMap[task] = true
		}
	}

	out := make(map[string]map[string]WindowedAggregation)
	var mu sync.Mutex

	err := s.provider.ScanSnapshots(ctx, agentID, from, to, func(sl *SnapshotLine) {
		ts := sl.TS.UTC()
		if ts.Before(from.UTC()) || ts.After(to.UTC()) {
			return
		}
		if len(filterMap) > 0 && !filterMap[sl.Task] {
			return
		}

		w := ts.Truncate(step)
		wk := w.Format(time.RFC3339)

		mu.Lock()
		if _, ok := out[wk]; !ok {
			out[wk] = map[string]WindowedAggregation{}
		}
		a := out[wk][sl.Task]
		a = updateAggregation(a, sl)
		out[wk][sl.Task] = a
		mu.Unlock()
	})
	if err != nil {
		return nil, err
	}

	return out, nil
}

// aggregateByAgent aggregates statistics for the entire agent
// filterTasks is a list of task hashes to filter by. Empty list means no filter.
func (s *Service) aggregateByAgent(ctx context.Context, agentID string, from, to time.Time, step time.Duration, filterTasks []string) (map[string]WindowedAggregation, error) {
	filterMap := make(map[string]bool)
	for _, task := range filterTasks {
		if task != "" {
			filterMap[task] = true
		}
	}

	timestampAggs := make(map[time.Time]*WindowedAggregation)
	var mu sync.Mutex

	err := s.provider.ScanSnapshots(ctx, agentID, from, to, func(sl *SnapshotLine) {
		ts := sl.TS.UTC()
		if ts.Before(from.UTC()) || ts.After(to.UTC()) {
			return
		}
		if len(filterMap) > 0 && !filterMap[sl.Task] {
			return
		}

		tsKey := ts.Truncate(time.Second)

		mu.Lock()
		if timestampAggs[tsKey] == nil {
			timestampAggs[tsKey] = &WindowedAggregation{}
		}

		a := timestampAggs[tsKey]
		a.Snaps++
		a.DlKB += int64(sl.DlKB)
		a.UlKB += int64(sl.UlKB)
		a.Seeders = calculateIncrementalAverage(a.Seeders, a.Snaps, int64(sl.Sd))
		a.Leechers = calculateIncrementalAverage(a.Leechers, a.Snaps, int64(sl.Lc))
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
		mu.Unlock()
	})
	if err != nil {
		return nil, err
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
			if tsAgg.DlKB > windowAgg.DlKB {
				windowAgg.DlKB = tsAgg.DlKB
			}
			if tsAgg.UlKB > windowAgg.UlKB {
				windowAgg.UlKB = tsAgg.UlKB
			}
			totalSnaps := windowAgg.Snaps + tsAgg.Snaps
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
	type taskWindowEntry struct {
		window   string
		task     string
		firstUlB int64
		firstTS  time.Time
		lastUlB  int64
		lastTS   time.Time
	}

	taskWindows := make(map[string]map[string]*taskWindowEntry)
	var mu sync.Mutex

	err := s.provider.ScanSnapshots(ctx, agentID, from, to, func(sl *SnapshotLine) {
		ts := sl.TS.UTC()
		if ts.Before(from.UTC()) || ts.After(to.UTC()) {
			return
		}

		w := ts.Truncate(step)
		wk := w.Format(time.RFC3339)

		mu.Lock()
		if taskWindows[sl.Task] == nil {
			taskWindows[sl.Task] = make(map[string]*taskWindowEntry)
		}
		if taskWindows[sl.Task][wk] == nil {
			taskWindows[sl.Task][wk] = &taskWindowEntry{
				window:   wk,
				task:     sl.Task,
				firstUlB: sl.UlB,
				firstTS:  ts,
				lastUlB:  sl.UlB,
				lastTS:   ts,
			}
		} else {
			entry := taskWindows[sl.Task][wk]
			if ts.Before(entry.firstTS) {
				entry.firstUlB = sl.UlB
				entry.firstTS = ts
			}
			if ts.After(entry.lastTS) {
				entry.lastUlB = sl.UlB
				entry.lastTS = ts
			}
		}
		mu.Unlock()
	})
	if err != nil {
		return nil, err
	}

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

	sort.Slice(results, func(i, j int) bool {
		return results[i].Diff > results[j].Diff
	})

	if limit > 0 && len(results) > limit {
		results = results[:limit]
	}

	return results, nil
}
