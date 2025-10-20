package statistics

import (
	"bufio"
	"compress/gzip"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"time"

	"github.com/gardarr/gardarr/internal/infra/database"
	"github.com/gardarr/gardarr/internal/middlewares"
	"github.com/gardarr/gardarr/internal/models"
	stats "github.com/gardarr/gardarr/internal/services/statistics"
	"github.com/gardarr/gardarr/pkg/env"
	"github.com/gin-gonic/gin"
)

type Module struct {
	group *gin.RouterGroup
	db    *database.Database
}

func NewModule(router *gin.RouterGroup, db *database.Database) *Module {
	return &Module{
		group: router.Group("/statistics"),
		db:    db,
	}
}

func (m *Module) Register() {
	m.group.Use(middlewares.SessionMiddleware(m.db))

	m.group.GET("/agents/:agent_id/days/:date/index", m.getDayIndex)
	m.group.GET("/agents/:agent_id/days/:date/hours", m.getDayHours)
	m.group.GET("/agents/:agent_id/range", m.getRangeSummary)
	m.group.GET("/agents/:agent_id/range/windowed", m.getWindowed)
	m.group.GET("/agents/:agent_id/upload-diffs", m.getUploadDiffs)
}

// GET /v1/statistics/agents/:agent_id/days/:date/index
func (m *Module) getDayIndex(c *gin.Context) {
	agentID := c.Param("agent_id")
	dateStr := c.Param("date")
	if agentID == "" || dateStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "agent_id and date are required"})
		return
	}

	var rows []models.StatsFileIndex
	if err := m.db.DB.Where("agent_id = ? AND date = ?", agentID, dateStr).Order("hour ASC").Find(&rows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to query index"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"agent_id": agentID,
		"date":     dateStr,
		"hours":    rows,
	})
}

// GET /v1/statistics/agents/:agent_id/days/:date/hours
func (m *Module) getDayHours(c *gin.Context) {
	agentID := c.Param("agent_id")
	dateStr := c.Param("date")
	if agentID == "" || dateStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "agent_id and date are required"})
		return
	}

	var rows []models.StatsFileHourSummary
	if err := m.db.DB.Where("agent_id = ? AND date = ?", agentID, dateStr).Order("hour ASC").Find(&rows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to query hourly summary"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"agent_id": agentID,
		"date":     dateStr,
		"hours":    rows,
	})
}

// GET /v1/statistics/agents/:agent_id/range/windowed?from=YYYY-MM-DDTHH:MM:SSZ&to=...&step=5m&group_by=agent|task&task_hash=optional
// Returns a breakdown in fixed windows across the range. If group_by=task, returns per-task metrics per window.
func (m *Module) getWindowed(c *gin.Context) {
	agentID := c.Param("agent_id")
	fromStr := c.Query("from")
	toStr := c.Query("to")
	stepStr := c.DefaultQuery("step", "5m")
	groupBy := c.DefaultQuery("group_by", "agent") // or "task"
	filterTask := c.Query("task_hash")

	if agentID == "" || fromStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "agent_id and from are required"})
		return
	}
	step, err := time.ParseDuration(stepStr)
	if err != nil || step <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid step"})
		return
	}

	// Parse timestamps (support date-only fallback)
	parseTime := func(s string) (time.Time, error) {
		layouts := []string{time.RFC3339, "2006-01-02 15:04:05", "2006-01-02"}
		for _, l := range layouts {
			if t, e := time.Parse(l, s); e == nil {
				return t, nil
			}
		}
		return time.Time{}, fmt.Errorf("invalid time format")
	}
	from, err := parseTime(fromStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid from"})
		return
	}
	if toStr == "" {
		toStr = time.Now().UTC().Format(time.RFC3339)
	}
	to, err := parseTime(toStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid to"})
		return
	}
	if !to.After(from) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "to must be after from"})
		return
	}

	// Build unique file set from StatsFileIndex between dates
	var idx []models.StatsFileIndex
	fromDate := from.UTC().Format("2006-01-02")
	toDate := to.UTC().Format("2006-01-02")
	if err := m.db.DB.Where("agent_id = ? AND date >= ? AND date <= ?", agentID, fromDate, toDate).Find(&idx).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to query file index"})
		return
	}
	fileSet := make(map[string]struct{})
	for _, r := range idx {
		if r.FilePath == "" {
			continue
		}
		fileSet[r.FilePath] = struct{}{}
	}
	files := make([]string, 0, len(fileSet))
	for p := range fileSet {
		files = append(files, p)
	}
	sort.Strings(files)

	// Fallback: if no files from index, try to discover daily files directly in STATISTICS_DIR (or ./data/statistics)
	if len(files) == 0 {
		base := env.Get("STATISTICS_DIR").Default("./data/statistics").Value()
		// Also try ./data if base doesn't exist
		if _, err := os.Stat(base); err != nil {
			if base2 := "./data"; true {
				if _, err2 := os.Stat(base2); err2 == nil {
					base = base2
				}
			}
		}
		cur := from.UTC().Truncate(24 * time.Hour)
		end := to.UTC().Truncate(24 * time.Hour)
		for !cur.After(end) {
			yyyy := cur.Format("2006")
			mm := cur.Format("01")
			day := cur.Format("2006-01-02")
			// Try base/<YYYY>/<MM>/<agentID>/<agentID>-YYYY-MM-DD.jsonl.gz
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
		// As a last resort, recursively glob for agent files anywhere under base
		if len(files) == 0 {
			// pattern: **/agentID-*.jsonl.gz
			// Walk base and collect matches
			_ = filepath.Walk(base, func(path string, info os.FileInfo, err error) error {
				if err != nil || info == nil || info.IsDir() {
					return nil
				}
				name := info.Name()
				// expect prefix agentID-YYYY-MM-DD.jsonl.gz
				if len(name) > len(agentID)+1 && name[:len(agentID)+1] == agentID+"-" && filepath.Ext(name) == ".gz" {
					// extract date segment
					// name format agentID-YYYY-MM-DD.jsonl.gz
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
			sort.Strings(files)
		}
	}

	// Prepare windows aggregation structures
	type agg struct {
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

	// When group_by=task, we store map[windowStart][taskHash]agg, else map[windowStart]agg
	if groupBy == "task" {
		out := make(map[string]map[string]agg)
		// Iterate files and accumulate
		for _, p := range files {
			_ = m.scanFile(p, func(sl *stats.SnapshotLine) {
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
					out[wk] = map[string]agg{}
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
		c.JSON(http.StatusOK, gin.H{
			"agent_id": agentID,
			"from":     from.UTC(),
			"to":       to.UTC(),
			"step":     step.String(),
			"group_by": "task",
			"windows":  out,
		})
		return
	}

	out := make(map[string]agg)
	for _, p := range files {
		_ = m.scanFile(p, func(sl *stats.SnapshotLine) {
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
	c.JSON(http.StatusOK, gin.H{
		"agent_id": agentID,
		"from":     from.UTC(),
		"to":       to.UTC(),
		"step":     step.String(),
		"group_by": "agent",
		"windows":  out,
	})
}

// GET /v1/statistics/agents/:agent_id/upload-diff?from=YYYY-MM-DDTHH:MM:SSZ&to=...&step=5m&limit=10
// Returns tasks with highest upload difference (total_ul_bytes increase) per window
func (m *Module) getUploadDiffs(c *gin.Context) {
	agentID := c.Param("agent_id")
	fromStr := c.Query("from")
	toStr := c.Query("to")
	stepStr := c.DefaultQuery("step", "5m")
	limitStr := c.DefaultQuery("limit", "10")

	if agentID == "" || fromStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "agent_id and from are required"})
		return
	}

	step, err := time.ParseDuration(stepStr)
	if err != nil || step <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid step"})
		return
	}

	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid limit"})
		return
	}

	// Parse timestamps (support date-only fallback)
	parseTime := func(s string) (time.Time, error) {
		layouts := []string{time.RFC3339, "2006-01-02 15:04:05", "2006-01-02"}
		for _, l := range layouts {
			if t, e := time.Parse(l, s); e == nil {
				return t, nil
			}
		}
		return time.Time{}, fmt.Errorf("invalid time format")
	}
	from, err := parseTime(fromStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid from"})
		return
	}
	if toStr == "" {
		toStr = time.Now().UTC().Format(time.RFC3339)
	}
	to, err := parseTime(toStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid to"})
		return
	}
	if !to.After(from) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "to must be after from"})
		return
	}

	// Build unique file set from StatsFileIndex between dates
	var idx []models.StatsFileIndex
	fromDate := from.UTC().Format("2006-01-02")
	toDate := to.UTC().Format("2006-01-02")
	if err := m.db.DB.Where("agent_id = ? AND date >= ? AND date <= ?", agentID, fromDate, toDate).Find(&idx).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to query file index"})
		return
	}
	fileSet := make(map[string]struct{})
	for _, r := range idx {
		if r.FilePath == "" {
			continue
		}
		fileSet[r.FilePath] = struct{}{}
	}
	files := make([]string, 0, len(fileSet))
	for p := range fileSet {
		files = append(files, p)
	}
	sort.Strings(files)

	// Fallback: if no files from index, try to discover daily files directly
	if len(files) == 0 {
		base := env.Get("STATISTICS_DIR").Default("./data/statistics").Value()
		if _, err := os.Stat(base); err != nil {
			if base2 := "./data"; true {
				if _, err2 := os.Stat(base2); err2 == nil {
					base = base2
				}
			}
		}
		cur := from.UTC().Truncate(24 * time.Hour)
		end := to.UTC().Truncate(24 * time.Hour)
		for cur.Before(end) || cur.Equal(end) {
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
			sort.Strings(files)
		}
	}

	// Track first and last upload values per task per window
	type taskWindowData struct {
		FirstUlB int64  `json:"first_ul_bytes"`
		LastUlB  int64  `json:"last_ul_bytes"`
		Diff     int64  `json:"diff"`
		Window   string `json:"window"`
		Task     string `json:"task"`
	}

	taskWindows := make(map[string]map[string]*taskWindowData) // task -> window -> data

	// Scan files and collect first/last values per task per window
	for _, p := range files {
		_ = m.scanFile(p, func(sl *stats.SnapshotLine) {
			ts := sl.TS.UTC()
			if ts.Before(from.UTC()) || ts.After(to.UTC()) {
				return
			}
			w := ts.Truncate(step)
			wk := w.Format(time.RFC3339)

			if taskWindows[sl.Task] == nil {
				taskWindows[sl.Task] = make(map[string]*taskWindowData)
			}
			if taskWindows[sl.Task][wk] == nil {
				taskWindows[sl.Task][wk] = &taskWindowData{
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

	// Calculate differences and collect results
	var results []taskWindowData
	for _, taskMap := range taskWindows {
		for _, twd := range taskMap {
			twd.Diff = twd.LastUlB - twd.FirstUlB
			if twd.Diff > 0 { // Only include positive differences
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

	c.JSON(http.StatusOK, gin.H{
		"agent_id": agentID,
		"from":     from.UTC(),
		"to":       to.UTC(),
		"step":     step.String(),
		"limit":    limit,
		"results":  results,
	})
}

// scanFile opens a gzip JSONL file and calls fn for each parsed SnapshotLine.
func (m *Module) scanFile(path string, fn func(*stats.SnapshotLine)) error {
	if path == "" {
		return nil
	}
	// Resolve relative path off current working directory if needed
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
	r := bufio.NewScanner(gz)
	r.Buffer(make([]byte, 0, 64*1024), 10*1024*1024) // up to 10MB per line
	for r.Scan() {
		var sl stats.SnapshotLine
		if err := json.Unmarshal(r.Bytes(), &sl); err == nil {
			fn(&sl)
		}
	}
	return nil
}

// GET /v1/statistics/agents/:agent_id/range?from=YYYY-MM-DD&to=YYYY-MM-DD
func (m *Module) getRangeSummary(c *gin.Context) {
	agentID := c.Param("agent_id")
	fromStr := c.Query("from")
	toStr := c.Query("to")
	if agentID == "" || fromStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "agent_id and from are required"})
		return
	}
	if toStr == "" {
		toStr = time.Now().UTC().Format("2006-01-02")
	}

	// accumulate per day across the range using StatsFileHourSummary
	var rows []models.StatsFileHourSummary
	if err := m.db.DB.Where("agent_id = ? AND date >= ? AND date <= ?", agentID, fromStr, toStr).Find(&rows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to query range summary"})
		return
	}

	type agg struct {
		TasksSeen int64 `json:"tasks_seen"`
		ActiveDl  int64 `json:"active_dl"`
		ActiveUl  int64 `json:"active_ul"`
		TotalDlKB int64 `json:"total_dl_kb"`
		TotalUlKB int64 `json:"total_ul_kb"`
	}

	sum := agg{}
	perDay := map[string]agg{}
	for _, r := range rows {
		sum.TasksSeen += int64(r.TasksSeen)
		sum.ActiveDl += int64(r.ActiveDlCount)
		sum.ActiveUl += int64(r.ActiveUlCount)
		sum.TotalDlKB += r.TotalDlKBs
		sum.TotalUlKB += r.TotalUlKBs
		a := perDay[r.Date]
		a.TasksSeen += int64(r.TasksSeen)
		a.ActiveDl += int64(r.ActiveDlCount)
		a.ActiveUl += int64(r.ActiveUlCount)
		a.TotalDlKB += r.TotalDlKBs
		a.TotalUlKB += r.TotalUlKBs
		perDay[r.Date] = a
	}

	c.JSON(http.StatusOK, gin.H{
		"agent_id": agentID,
		"from":     fromStr,
		"to":       toStr,
		"total":    sum,
		"per_day":  perDay,
		"days":     len(perDay),
	})
}
