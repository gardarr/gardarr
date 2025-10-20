package statistics

import (
	"context"
	"time"

	"github.com/gardarr/gardarr/internal/entities"
	"github.com/gardarr/gardarr/internal/infra/database"
	"github.com/gardarr/gardarr/internal/models"
	agentmanager "github.com/gardarr/gardarr/internal/services/agentmanager"
	"github.com/gardarr/gardarr/pkg/env"
)

type Service struct {
	db       *database.Database
	agents   *agentmanager.Service
	baseDir  string
	interval time.Duration
	enabled  bool
}

func NewService(db *database.Database, agents *agentmanager.Service) *Service {
	return &Service{
		db:       db,
		agents:   agents,
		baseDir:  env.Get("STATISTICS_DIR").Default("./data/statistics").Value(),
		interval: env.Get("STATISTICS_INTERVAL").Default("30s").ValueDuration(),
		enabled:  env.Get("STATISTICS_ENABLED").Default(true).ValueBool(),
	}
}

func (s *Service) Start(ctx context.Context) {
	if !s.enabled {
		return
	}
	ticker := time.NewTicker(s.interval)
	go func() {
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				s.collectOnce(ctx)
			case <-ctx.Done():
				return
			}
		}
	}()
}

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
