package statistics

import (
	"bufio"
	"compress/gzip"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"

	"github.com/jfxdev/gardarr/internal/infra/database"
	"github.com/jfxdev/gardarr/internal/models"
	"github.com/jfxdev/gardarr/pkg/validations"
	"gorm.io/gorm"
)

// FilesystemProvider stores statistics as gzip-compressed JSONL files on disk,
// with optional database-backed indexing for fast lookups.
type FilesystemProvider struct {
	db      *database.Database
	baseDir string
}

// FilesystemProviderConfig holds configuration for the filesystem provider.
type FilesystemProviderConfig struct {
	DB      *database.Database
	BaseDir string
}

// NewFilesystemProvider creates a FilesystemProvider configured with the provided FilesystemProviderConfig.
// The returned provider uses cfg.DB for optional database-backed indexing and cfg.BaseDir as the base directory
// for on-disk statistics files.
func NewFilesystemProvider(cfg FilesystemProviderConfig) *FilesystemProvider {
	return &FilesystemProvider{
		db:      cfg.DB,
		baseDir: cfg.BaseDir,
	}
}

// WriteSnapshots writes snapshot lines to a daily gzip JSONL file for the agent.
func (p *FilesystemProvider) WriteSnapshots(ctx context.Context, agentID string, ts time.Time, lines []SnapshotLine) (retErr error) {
	var fw FileWriter
	if err := fw.OpenDaily(p.baseDir, agentID, ts); err != nil {
		return err
	}
	defer func() {
		if closeErr := fw.Close(); closeErr != nil && retErr == nil {
			retErr = closeErr
		}
	}()

	for _, line := range lines {
		if err := fw.WriteLine(line); err != nil {
			return err
		}
	}
	if err := fw.Flush(); err != nil {
		return err
	}

	// Upsert file index for current hour
	if err := p.upsertFileIndex(ctx, agentID, ts, fw.Path(), fw.Lines(), fw.Size()); err != nil {
		return err
	}
	return nil
}

// UpsertHourSummary stores or updates aggregated hourly statistics in the database.
func (p *FilesystemProvider) UpsertHourSummary(ctx context.Context, agentID string, ts time.Time, data HourSummaryInput) error {
	if p.db == nil || p.db.DB == nil {
		return nil
	}
	date := ts.Format("2006-01-02")
	hour := ts.Hour()
	var sum models.StatsFileHourSummary
	tx := p.db.DB.WithContext(ctx)
	err := tx.Where("agent_id = ? AND date = ? AND hour = ?", agentID, date, hour).First(&sum).Error
	if err == nil {
		sum.TasksSeen += data.TasksSeen
		sum.ActiveDlCount += data.DlActive
		sum.ActiveUlCount += data.UlActive
		sum.TotalDlKBs += data.TotalDlKB
		sum.TotalUlKBs += data.TotalUlKB
		return tx.Save(&sum).Error
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	sum = models.StatsFileHourSummary{
		AgentID:       agentID,
		Date:          date,
		Hour:          hour,
		TasksSeen:     data.TasksSeen,
		ActiveDlCount: data.DlActive,
		ActiveUlCount: data.UlActive,
		TotalDlKBs:    data.TotalDlKB,
		TotalUlKBs:    data.TotalUlKB,
	}
	return tx.Create(&sum).Error
}

// ScanSnapshots discovers and reads gzip JSONL files, calling fn for each line in range.
func (p *FilesystemProvider) ScanSnapshots(ctx context.Context, agentID string, from, to time.Time, fn func(*SnapshotLine)) error {
	files, err := p.discoverFiles(ctx, agentID, from, to)
	if err != nil {
		return err
	}
	for _, path := range files {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}
		if err := scanFile(path, fn); err != nil {
			return err
		}
	}
	return nil
}

// GetHourSummaries retrieves hourly summaries for an agent in a date range.
func (p *FilesystemProvider) GetHourSummaries(ctx context.Context, agentID string, fromDate, toDate string) ([]HourSummaryRow, error) {
	if p.db == nil || p.db.DB == nil {
		return nil, nil
	}
	var rows []models.StatsFileHourSummary
	if err := p.db.DB.WithContext(ctx).
		Where("agent_id = ? AND date >= ? AND date <= ?", agentID, fromDate, toDate).
		Order("date ASC, hour ASC").
		Find(&rows).Error; err != nil {
		return nil, fmt.Errorf("failed to query hourly summary: %w", err)
	}
	out := make([]HourSummaryRow, len(rows))
	for i, r := range rows {
		out[i] = HourSummaryRow{
			AgentID:       r.AgentID,
			Date:          r.Date,
			Hour:          r.Hour,
			TasksSeen:     r.TasksSeen,
			ActiveDlCount: r.ActiveDlCount,
			ActiveUlCount: r.ActiveUlCount,
			TotalDlKBs:    r.TotalDlKBs,
			TotalUlKBs:    r.TotalUlKBs,
			CreatedAt:     r.CreatedAt,
			UpdatedAt:     r.UpdatedAt,
		}
	}
	return out, nil
}

// GetDayIndex retrieves file index entries for an agent on a specific date.
func (p *FilesystemProvider) GetDayIndex(ctx context.Context, agentID string, date string) ([]DayIndexRow, error) {
	if p.db == nil || p.db.DB == nil {
		return nil, nil
	}
	var rows []models.StatsFileIndex
	if err := p.db.DB.WithContext(ctx).
		Where("agent_id = ? AND date = ?", agentID, date).
		Order("hour ASC").
		Find(&rows).Error; err != nil {
		return nil, fmt.Errorf("failed to query file index: %w", err)
	}
	out := make([]DayIndexRow, len(rows))
	for i, r := range rows {
		out[i] = DayIndexRow{
			AgentID:   r.AgentID,
			Date:      r.Date,
			Hour:      r.Hour,
			FilePath:  r.FilePath,
			StartTS:   r.StartTS,
			EndTS:     r.EndTS,
			LineCount: r.LineCount,
			SizeBytes: r.SizeBytes,
		}
	}
	return out, nil
}

// GetTotalSize walks the statistics base directory and returns the total size
// in bytes of all .jsonl.gz files.
func (p *FilesystemProvider) GetTotalSize(ctx context.Context) (int64, error) {
	base := p.resolveBaseDir()
	if base == "" {
		return 0, nil
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

// Purge deletes statistics files and database indices older than cutoffDate.
func (p *FilesystemProvider) Purge(ctx context.Context, cutoffDate string) error {
	// DB purge
	if p.db != nil && p.db.DB != nil {
		if err := p.db.DB.WithContext(ctx).
			Where("date < ?", cutoffDate).
			Delete(&models.StatsFileHourSummary{}).Error; err != nil {
			return fmt.Errorf("purge hour summaries: %w", err)
		}
		if err := p.db.DB.WithContext(ctx).
			Where("date < ?", cutoffDate).
			Delete(&models.StatsFileIndex{}).Error; err != nil {
			return fmt.Errorf("purge file index: %w", err)
		}
	}

	// FS purge
	base := p.resolveBaseDir()
	if base == "" {
		return nil
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

// Close is a no-op for the filesystem provider.
func (p *FilesystemProvider) Close() error {
	return nil
}

// --- internal helpers ---

func (p *FilesystemProvider) upsertFileIndex(ctx context.Context, agentID string, ts time.Time, path string, lines int64, size int64) error {
	if p.db == nil || p.db.DB == nil {
		return nil
	}
	date := ts.Format("2006-01-02")
	hour := ts.Hour()
	var idx models.StatsFileIndex
	tx := p.db.DB.WithContext(ctx)
	err := tx.Where("file_path = ?", path).First(&idx).Error
	if err == nil {
		idx.LineCount += int(lines)
		idx.SizeBytes += size
		idx.EndTS = ts
		return tx.Save(&idx).Error
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
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

func (p *FilesystemProvider) resolveBaseDir() string {
	base := p.baseDir
	if _, err := os.Stat(base); err != nil {
		if _, err2 := os.Stat("./data"); err2 == nil {
			slog.Warn("configured statistics base directory not found, falling back to ./data",
				"configured", base,
				"fallback", "./data",
			)
			return "./data"
		}
		return ""
	}
	return base
}

func (p *FilesystemProvider) discoverFiles(ctx context.Context, agentID string, from, to time.Time) ([]string, error) {
	fromDate := from.UTC().Format("2006-01-02")
	toDate := to.UTC().Format("2006-01-02")

	// Try to get files from database index
	var idx []models.StatsFileIndex
	if p.db != nil && p.db.DB != nil {
		if err := p.db.DB.WithContext(ctx).
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
	for fp := range fileSet {
		files = append(files, fp)
	}

	// If no files from index, discover from filesystem
	if len(files) == 0 {
		files = p.discoverFilesFromFS(agentID, from, to, fromDate, toDate)
	}

	sort.Strings(files)
	return files, nil
}

func (p *FilesystemProvider) discoverFilesFromFS(agentID string, from, to time.Time, fromDate, toDate string) []string {
	if validations.ValidateSafePathComponent(agentID) != nil {
		return nil
	}

	base := p.resolveBaseDir()
	if base == "" {
		return nil
	}

	var dates []time.Time
	cur := from.UTC().Truncate(24 * time.Hour)
	end := to.UTC().Truncate(24 * time.Hour)
	for !cur.After(end) {
		dates = append(dates, cur)
		cur = cur.Add(24 * time.Hour)
	}

	type dateResult struct {
		path string
	}

	resultsChan := make(chan dateResult, len(dates))
	var wg sync.WaitGroup

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

	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for date := range dateChan {
				yyyy := date.Format("2006")
				mm := date.Format("01")
				day := date.Format("2006-01-02")
				filename := agentID + "-" + day + ".jsonl.gz"
				candidateParts := [][]string{
					{yyyy, mm, agentID, filename},
					{"statistics", yyyy, mm, agentID, filename},
				}
				for _, parts := range candidateParts {
					cp, err := validations.SafeJoinPath(base, parts...)
					if err != nil {
						continue
					}
					if _, err := os.Stat(cp); err == nil {
						resultsChan <- dateResult{path: cp}
						break
					}
				}
			}
		}()
	}

	go func() {
		wg.Wait()
		close(resultsChan)
	}()

	var files []string
	for result := range resultsChan {
		files = append(files, result.path)
	}

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

// scanFile reads a gzip-compressed JSONL file at path and invokes fn for each successfully decoded SnapshotLine.
// If path is empty the function does nothing. Malformed JSON lines are skipped; any error encountered while opening,
// decompressing, or scanning the file is returned.
func scanFile(path string, fn func(*SnapshotLine)) error {
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