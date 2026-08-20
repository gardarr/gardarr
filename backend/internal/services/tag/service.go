package tag

import (
	"context"
	"strings"

	"github.com/jfxdev/gardarr/internal/entities"
	"github.com/jfxdev/gardarr/internal/infra/database"
	tagrepository "github.com/jfxdev/gardarr/internal/repository/tag"
	"github.com/jfxdev/gardarr/internal/services/workermanager"
	"github.com/jfxdev/gardarr/pkg/logger"
)

type Service struct {
	repository *tagrepository.Repository
	workers    *workermanager.Service
}

func NewService(db *database.Database, workers *workermanager.Service) *Service {
	return &Service{
		repository: tagrepository.NewRepository(db),
		workers:    workers,
	}
}

// ListTags returns the union of locally-stored tags and tags observed live
// on workers, with usage counts. A tag observed on a worker but absent
// locally still appears (with no color/icon) - the local table is an
// enrichment layer, never the source of truth for a tag's existence.
func (s *Service) ListTags(ctx context.Context) ([]*entities.Tag, error) {
	stored, err := s.repository.ListTags(ctx)
	if err != nil {
		return nil, err
	}

	usage := s.collectUsage(ctx)

	seen := make(map[string]struct{}, len(stored))
	result := make([]*entities.Tag, 0, len(stored)+len(usage))
	for _, t := range stored {
		if t.Kind != entities.TagKindScope {
			// Scope rows color every tag under that scope but are never a
			// tag name on a torrent, so they carry no usage of their own.
			t.UsageCount = usage[t.Name]
			seen[t.Name] = struct{}{}
		}
		result = append(result, t)
	}

	for name, count := range usage {
		if _, exists := seen[name]; exists {
			continue
		}
		result = append(result, &entities.Tag{
			Name:       name,
			Kind:       entities.TagKindTag,
			UsageCount: count,
		})
	}

	return result, nil
}

// collectUsage aggregates tag usage across every worker's torrents. Worker
// failures are logged and otherwise tolerated - a partial view (or none)
// still lets the rest of ListTags succeed.
func (s *Service) collectUsage(ctx context.Context) map[string]int {
	usage := make(map[string]int)
	if s.workers == nil {
		return usage
	}

	result, err := s.workers.ListWorkersTasks(ctx)
	if err != nil {
		logger.Error("failed to list worker tasks for tag usage", "error", err.Error())
		return usage
	}
	for workerID, errMsg := range result.Errors {
		logger.Error("worker unreachable while collecting tag usage", "worker_id", workerID, "error", errMsg)
	}

	for _, task := range result.Tasks {
		for _, tag := range task.Tags {
			if trimmed := strings.TrimSpace(tag); trimmed != "" {
				usage[trimmed]++
			}
		}
	}

	return usage
}

// GetTagByID retrieves a locally-stored tag by its ID.
func (s *Service) GetTagByID(ctx context.Context, id string) (*entities.Tag, error) {
	return s.repository.GetTagByID(ctx, id)
}

// CreateTag persists a tag locally and, for tag rows (not scope rows, which
// don't exist on qBittorrent), best-effort creates it on every worker's
// server. A worker that fails or is offline is logged and otherwise
// tolerated - the local row is the durable record, and that worker picks
// the tag up on its next write.
func (s *Service) CreateTag(ctx context.Context, tag entities.Tag) (*entities.Tag, error) {
	if tag.Kind == "" {
		tag.Kind = entities.TagKindTag
	}

	if tag.Kind == entities.TagKindTag && s.workers != nil {
		if _, err := s.workers.CreateTagsAcrossWorkers(ctx, []string{tag.Name}); err != nil {
			logger.Error("failed to create tag across workers", "name", tag.Name, "error", err.Error())
		}
	}

	return s.repository.CreateTag(ctx, tag)
}

// UpdateTag updates a tag's color/icon. Name and Kind are immutable.
func (s *Service) UpdateTag(ctx context.Context, tag entities.Tag) (*entities.Tag, error) {
	return s.repository.UpdateTag(ctx, tag)
}
