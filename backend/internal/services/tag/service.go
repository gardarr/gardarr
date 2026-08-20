package tag

import (
	"context"
	"errors"
	"slices"
	"sort"
	"strings"

	"github.com/jfxdev/gardarr/internal/entities"
	"github.com/jfxdev/gardarr/internal/infra/database"
	tagrepository "github.com/jfxdev/gardarr/internal/repository/tag"
	"github.com/jfxdev/gardarr/internal/services/workermanager"
	"github.com/jfxdev/gardarr/internal/tagrules"
	"github.com/jfxdev/gardarr/pkg/logger"
)

// ErrMergeTargetInSources is returned when a merge/rename request names
// target as one of its own sources.
var ErrMergeTargetInSources = errors.New("target must not be one of sources")

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
		if _, _, err := s.workers.CreateTagsAcrossWorkers(ctx, []string{tag.Name}); err != nil {
			logger.Error("failed to create tag across workers", "name", tag.Name, "error", err.Error())
		}
	}

	return s.repository.CreateTag(ctx, tag)
}

// UpdateTag updates a tag's color/icon. Name and Kind are immutable.
func (s *Service) UpdateTag(ctx context.Context, tag entities.Tag) (*entities.Tag, error) {
	return s.repository.UpdateTag(ctx, tag)
}

// RenameTag is a merge with a single source (see MergeTags).
func (s *Service) RenameTag(ctx context.Context, from, to string) (map[string]string, error) {
	return s.MergeTags(ctx, []string{from}, to)
}

// MergeTags applies target to every torrent, on every worker, that
// currently holds any of sources, then deregisters sources - detaching
// them from any torrent that still carries them - and drops their local
// rows. Worker failures are reported per worker rather than failing the
// whole call; if every worker failed, local rows are left untouched so a
// retry starts from the same, consistent state.
func (s *Service) MergeTags(ctx context.Context, sources []string, target string) (map[string]string, error) {
	sources = dedupeNonEmpty(sources)
	target = strings.TrimSpace(target)

	if target == "" || len(sources) == 0 {
		return nil, errors.New("sources and target are required")
	}
	if slices.Contains(sources, target) {
		return nil, ErrMergeTargetInSources
	}

	var failed map[string]string
	allFailed := false

	if s.workers != nil {
		var total int
		var err error
		failed, total, err = s.workers.MergeTagsAcrossWorkers(ctx, sources, target)
		if err != nil {
			return nil, err
		}
		allFailed = total > 0 && len(failed) == total
	}

	if !allFailed {
		if err := s.repository.ReconcileMergedTags(ctx, sources); err != nil {
			return failed, err
		}
	}

	return failed, nil
}

// DeleteTag removes a tag everywhere. A "tag" row/name is deregistered
// from every worker - detaching it from every torrent that carries it -
// before its local row is dropped. A "scope" row has no counterpart on
// qBittorrent, so it's removed locally only. If every worker fails, the
// local row is kept so a retry starts from the same, consistent state.
func (s *Service) DeleteTag(ctx context.Context, kind entities.TagKind, name string) (map[string]string, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, errors.New("name is required")
	}
	if kind == "" {
		kind = entities.TagKindTag
	}

	var failed map[string]string
	allFailed := false

	if kind == entities.TagKindTag && s.workers != nil {
		var total int
		var err error
		failed, total, err = s.workers.DeleteTagAcrossWorkers(ctx, name)
		if err != nil {
			return nil, err
		}
		allFailed = total > 0 && len(failed) == total
	}

	if !allFailed {
		if err := s.repository.DeleteTagByName(ctx, kind, name); err != nil {
			return failed, err
		}
	}

	return failed, nil
}

// DetectConflicts reports backward-compatibility issues the scoped-tag
// rules introduce for tags that predate them: torrents holding more than
// one value for the same exclusive scope, and tags using a single ":"
// (grouped semantics, a new meaning) worth reviewing. Nothing is changed -
// existing data is reported, not reconciled, until the next write touches
// it.
func (s *Service) DetectConflicts(ctx context.Context) (*entities.TagConflictReport, error) {
	if s.workers == nil {
		return detectTagConflicts(nil), nil
	}

	result, err := s.workers.ListWorkersTasks(ctx)
	if err != nil {
		return nil, err
	}
	for workerID, errMsg := range result.Errors {
		logger.Error("worker unreachable while detecting tag conflicts", "worker_id", workerID, "error", errMsg)
	}

	return detectTagConflicts(result.Tasks), nil
}

// detectTagConflicts is DetectConflicts' pure core, over a flat task list
// from any number of workers.
func detectTagConflicts(tasks []*entities.Task) *entities.TagConflictReport {
	report := &entities.TagConflictReport{
		ScopeConflicts: []entities.ScopeConflict{},
		GroupedTags:    []string{},
	}

	groupedTags := make(map[string]struct{})

	for _, task := range tasks {
		byScope := make(map[string][]string)
		for _, tag := range task.Tags {
			switch parsed := tagrules.Parse(tag); parsed.Kind {
			case tagrules.KindScoped:
				byScope[parsed.Key] = append(byScope[parsed.Key], parsed.Raw)
			case tagrules.KindGrouped:
				groupedTags[parsed.Raw] = struct{}{}
			}
		}

		for scope, tags := range byScope {
			if len(tags) < 2 {
				continue
			}
			sort.Strings(tags)
			report.ScopeConflicts = append(report.ScopeConflicts, entities.ScopeConflict{
				WorkerID: task.WorkerID.String(),
				TaskHash: task.Hash,
				TaskName: task.Name,
				Scope:    scope,
				Tags:     tags,
			})
		}
	}

	for tag := range groupedTags {
		report.GroupedTags = append(report.GroupedTags, tag)
	}
	sort.Strings(report.GroupedTags)
	sort.Slice(report.ScopeConflicts, func(i, j int) bool {
		a, b := report.ScopeConflicts[i], report.ScopeConflicts[j]
		if a.TaskName != b.TaskName {
			return a.TaskName < b.TaskName
		}
		return a.Scope < b.Scope
	})

	return report
}

// dedupeNonEmpty trims and deduplicates a list of tag names, dropping
// empty entries.
func dedupeNonEmpty(names []string) []string {
	result := make([]string, 0, len(names))
	seen := make(map[string]struct{}, len(names))

	for _, name := range names {
		trimmed := strings.TrimSpace(name)
		if trimmed == "" {
			continue
		}
		if _, exists := seen[trimmed]; exists {
			continue
		}
		seen[trimmed] = struct{}{}
		result = append(result, trimmed)
	}

	return result
}
