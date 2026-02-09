package statistics

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jfxdev/gardarr/internal/infra/database"
	"github.com/jfxdev/gardarr/internal/middlewares"
	stats "github.com/jfxdev/gardarr/internal/services/statistics"
)

// splitAndTrim splits a string by separator and trims whitespace from each part
func splitAndTrim(s, sep string) []string {
	parts := strings.Split(s, sep)
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

type Module struct {
	group   *gin.RouterGroup
	db      *database.Database
	service *stats.Service
}

func NewModule(router *gin.RouterGroup, db *database.Database, service *stats.Service) *Module {
	return &Module{
		group:   router.Group("/statistics"),
		db:      db, // kept for session middleware
		service: service,
	}
}

func (m *Module) Register() {
	m.group.Use(middlewares.SessionMiddleware(m.db))

	m.group.GET("/agents/:agent_id/days/:date/index", m.getDayIndex)
	m.group.GET("/agents/:agent_id/days/:date/hours", m.getDayHours)
	m.group.GET("/agents/:agent_id/range", m.getRangeSummary)
	m.group.GET("/agents/:agent_id/range/windowed", m.getWindowed)
	m.group.GET("/agents/:agent_id/upload-diffs", m.getUploadDiffs)
	m.group.GET("/size", m.getTotalSize)
}

// GET /v1/statistics/agents/:agent_id/days/:date/index
func (m *Module) getDayIndex(c *gin.Context) {
	agentID := c.Param("agent_id")
	dateStr := c.Param("date")
	if agentID == "" || dateStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "agent_id and date are required"})
		return
	}

	rows, err := m.service.GetDayIndex(c.Request.Context(), agentID, dateStr)
	if err != nil {
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

	rows, err := m.service.GetHourSummaries(c.Request.Context(), agentID, dateStr, dateStr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to query hourly summary"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"agent_id": agentID,
		"date":     dateStr,
		"hours":    rows,
	})
}

// GET /v1/statistics/agents/:agent_id/range/windowed?from=YYYY-MM-DDTHH:MM:SSZ&to=...&step=5m&group_by=agent|task&task_hash=hash1,hash2,hash3
// Returns a breakdown in fixed windows across the range. If group_by=task, returns per-task metrics per window.
// task_hash can be a single hash or multiple comma-separated hashes to filter multiple tasks
func (m *Module) getWindowed(c *gin.Context) {
	agentID := c.Param("agent_id")
	fromStr := c.Query("from")
	toStr := c.Query("to")
	stepStr := c.DefaultQuery("step", "5m")
	groupBy := c.DefaultQuery("group_by", "agent")
	filterTasksStr := c.Query("task_hash")

	if agentID == "" || fromStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "agent_id and from are required"})
		return
	}

	// Parse task_hash: can be comma-separated for multiple tasks
	var filterTasks []string
	if filterTasksStr != "" {
		// Split by comma and trim whitespace
		for _, hash := range splitAndTrim(filterTasksStr, ",") {
			if hash != "" {
				filterTasks = append(filterTasks, hash)
			}
		}
	}

	step, err := time.ParseDuration(stepStr)
	if err != nil || step <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid step"})
		return
	}

	from, err := stats.ParseTime(fromStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid from"})
		return
	}

	if toStr == "" {
		toStr = time.Now().UTC().Format(time.RFC3339)
	}
	to, err := stats.ParseTime(toStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid to"})
		return
	}

	if !to.After(from) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "to must be after from"})
		return
	}

	windows, err := m.service.GetWindowedAggregation(c.Request.Context(), agentID, from, to, step, groupBy, filterTasks)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to compute windowed aggregation"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"agent_id":     agentID,
		"from":         from.UTC(),
		"to":           to.UTC(),
		"step":         step.String(),
		"group_by":     groupBy,
		"filter_tasks": filterTasks,
		"windows":      windows,
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

	from, err := stats.ParseTime(fromStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid from"})
		return
	}

	if toStr == "" {
		toStr = time.Now().UTC().Format(time.RFC3339)
	}
	to, err := stats.ParseTime(toStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid to"})
		return
	}

	if !to.After(from) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "to must be after from"})
		return
	}

	results, err := m.service.GetUploadDiffs(c.Request.Context(), agentID, from, to, step, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to compute upload diffs"})
		return
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

// GET /v1/statistics/size
// Returns the total size (in bytes) of all statistics files on disk
func (m *Module) getTotalSize(c *gin.Context) {
	total, err := m.service.GetTotalSize(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to compute size"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"total": total,
	})
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

	rows, err := m.service.GetHourSummaries(c.Request.Context(), agentID, fromStr, toStr)
	if err != nil {
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
