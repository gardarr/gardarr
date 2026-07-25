package integration

import (
	"context"
	"sync"
	"sync/atomic"
	"time"

	"github.com/jfxdev/gardarr/internal/entities"
	"github.com/jfxdev/gardarr/internal/infra/database"
	"github.com/jfxdev/gardarr/internal/repository/webhook"
	"github.com/jfxdev/gardarr/internal/repository/webhook_history"
	webhookService "github.com/jfxdev/gardarr/internal/services/integration/webhook"
	"github.com/jfxdev/gardarr/pkg/env"
	"github.com/jfxdev/gardarr/pkg/filters"
	"github.com/jfxdev/gardarr/pkg/logger"
)

// webhookWorker owns a single webhook's delivery goroutine and job queue, so
// a slow/unreachable endpoint only ever blocks its own queue.
type webhookWorker struct {
	svc     *webhookService.Service
	filter  *entities.EventFilter
	jobs    chan *entities.Event
	stopCh  chan struct{}
	dropped atomic.Int64
}

// Service manages integration events from the events system
type Service struct {
	enabled          bool
	eventChan        <-chan *entities.Event
	webhookRepo      *webhook.Repository
	historyRepo      *webhook_history.Repository
	webhookWorkers   map[string]*webhookWorker
	webhookQueueSize int
	mu               sync.RWMutex
}

// NewService creates a new integration service that consumes events
// from the provided channel and decides whether to forward them to webhooks
// or other integrations based on configuration
func NewService(eventChan <-chan *entities.Event, db *database.Database) *Service {
	queueSize := env.Get("WEBHOOK_QUEUE_SIZE").Default(100).ValueInt()
	if queueSize <= 0 {
		queueSize = 100
	}

	return &Service{
		enabled:          true,
		eventChan:        eventChan,
		webhookRepo:      webhook.NewRepository(db),
		historyRepo:      webhook_history.NewRepository(db),
		webhookWorkers:   make(map[string]*webhookWorker),
		webhookQueueSize: queueSize,
	}
}

// Start begins consuming events from the channel and processing
// them according to the configured integration rules. It runs until the provided
// context is canceled.
func (s *Service) Start(ctx context.Context) {
	if !s.enabled {
		return
	}

	// Load webhooks initially
	s.loadWebhooks(ctx)

	// Start cleanup job for old webhook history
	s.startHistoryCleanupJob(ctx)

	go func() {
		logger.Info("Integration service started - listening for events", "service", "integration")
		for {
			select {
			case event, ok := <-s.eventChan:
				if !ok {
					logger.Info("Event channel closed, stopping integration service", "service", "integration")
					return
				}
				s.processEvent(ctx, event)
			case <-ctx.Done():
				logger.Info("Integration service stopped", "service", "integration")
				return
			}
		}
	}()
}

// loadWebhooks loads all enabled webhooks from the database, stops any
// previous workers, and starts one worker goroutine per webhook.
func (s *Service) loadWebhooks(ctx context.Context) {
	webhooks, err := s.webhookRepo.ListEnabledWebhooks(ctx)
	if err != nil {
		logger.Error("Failed to load webhooks",
			"service", "integration",
			"error", err,
		)
		return
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	// Stop existing workers before replacing them
	for _, w := range s.webhookWorkers {
		close(w.stopCh)
	}

	s.webhookWorkers = make(map[string]*webhookWorker)

	for _, wh := range webhooks {
		svc := webhookService.NewService(wh.UUID, wh.URL, wh.InsecureSkipVerify, wh.TimeoutSeconds, s.historyRepo)
		webhookID := wh.UUID.String()

		w := &webhookWorker{
			svc:    svc,
			filter: wh.Filter,
			jobs:   make(chan *entities.Event, s.webhookQueueSize),
			stopCh: make(chan struct{}),
		}
		s.webhookWorkers[webhookID] = w
		go s.runWebhookWorker(ctx, webhookID, w)

		logger.Debug("Loaded webhook",
			"service", "integration",
			"webhook_id", webhookID,
			"url", wh.URL,
			"timeout", wh.TimeoutSeconds,
			"has_filter", wh.Filter != nil,
		)
	}

	logger.Info("Webhooks loaded",
		"service", "integration",
		"count", len(webhooks),
	)
}

// runWebhookWorker drains a single webhook's job queue sequentially, so
// delivery order to that endpoint is preserved without blocking any other
// webhook or the event consumer loop.
func (s *Service) runWebhookWorker(ctx context.Context, webhookID string, w *webhookWorker) {
	for {
		select {
		case event := <-w.jobs:
			if err := w.svc.SendEventWithRetry(ctx, event); err != nil {
				logger.Error("Failed to send event to webhook",
					"service", "integration",
					"event_id", event.UUID.String(),
					"webhook_id", webhookID,
					"error", err,
				)
			}
		case <-w.stopCh:
			return
		case <-ctx.Done():
			return
		}
	}
}

// ReloadWebhooks reloads all webhooks from the database
// This should be called after creating, updating, or deleting webhooks
func (s *Service) ReloadWebhooks(ctx context.Context) {
	s.loadWebhooks(ctx)
}

// webhookTarget is a snapshot of a webhook worker's routing info, used by
// processEvent without holding the service lock during dispatch.
type webhookTarget struct {
	id      string
	svc     *webhookService.Service
	filter  *entities.EventFilter
	jobs    chan<- *entities.Event
	dropped *atomic.Int64
}

// eventMetadata holds extracted metadata from an event for logging purposes
type eventMetadata struct {
	taskName string
	category string
	size     int
}

// extractEventMetadata extracts task name, category and size from event metadata
func extractEventMetadata(event *entities.Event) eventMetadata {
	meta := eventMetadata{}
	if event.Metadata == nil {
		return meta
	}

	if name, ok := event.Metadata["name"].(string); ok {
		meta.taskName = name
	}
	if cat, ok := event.Metadata["category"].(string); ok {
		meta.category = cat
	}
	if s, ok := event.Metadata["size"].(int); ok {
		meta.size = s
	} else if s, ok := event.Metadata["size"].(float64); ok {
		meta.size = int(s)
	}

	return meta
}

// getWebhookTargets returns a snapshot of current webhook workers' routing
// info, so processEvent can dispatch without holding the service lock.
func (s *Service) getWebhookTargets() []webhookTarget {
	s.mu.RLock()
	defer s.mu.RUnlock()

	targets := make([]webhookTarget, 0, len(s.webhookWorkers))
	for id, w := range s.webhookWorkers {
		targets = append(targets, webhookTarget{
			id:      id,
			svc:     w.svc,
			filter:  w.filter,
			jobs:    w.jobs,
			dropped: &w.dropped,
		})
	}
	return targets
}

// processEvent evaluates an event and decides whether to forward
// it to configured integrations (webhooks, notifications, etc.)
func (s *Service) processEvent(ctx context.Context, event *entities.Event) {
	if event == nil {
		return
	}

	meta := extractEventMetadata(event)

	logger.Info("Event received",
		"service", "integration",
		"event_type", event.Type,
		"worker_id", event.WorkerID.String(),
		"task_hash", event.TaskHash,
		"task_name", meta.taskName,
		"category", meta.category,
		"size", meta.size,
		"old_value", event.OldValue,
		"new_value", event.NewValue,
	)

	// Snapshot targets to avoid holding lock during network I/O
	targets := s.getWebhookTargets()

	// Enqueue onto each webhook's own worker instead of sending inline: one
	// slow/unreachable webhook must not stall delivery to the others, nor
	// block this goroutine from draining the next event off s.eventChan.
	// Delivery order within a single webhook is preserved by its worker.
	for _, target := range targets {
		if target.svc == nil || !target.svc.Enabled() {
			continue
		}
		if !filters.MatchesEvent(target.filter, event) {
			logger.Debug("Event filtered out for webhook",
				"service", "integration",
				"event_id", event.UUID.String(),
				"webhook_id", target.id,
				"event_type", event.Type,
				"new_value", event.NewValue,
			)
			continue
		}

		select {
		case target.jobs <- event:
		default:
			totalDropped := target.dropped.Add(1)
			logger.Warn("webhook job queue full, dropping event",
				"service", "integration",
				"event_id", event.UUID.String(),
				"webhook_id", target.id,
				"total_dropped", totalDropped,
			)
		}
	}
}

// Enabled returns whether the integration service is enabled
func (s *Service) Enabled() bool {
	return s.enabled
}

// startHistoryCleanupJob starts a background job that cleans up old webhook history
// It runs every 24 hours and deletes records older than 7 days
func (s *Service) startHistoryCleanupJob(ctx context.Context) {
	go func() {
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()

		// Run cleanup immediately on start
		s.cleanupOldHistory(ctx)

		for {
			select {
			case <-ticker.C:
				s.cleanupOldHistory(ctx)
			case <-ctx.Done():
				logger.Info("History cleanup job stopped", "service", "integration")
				return
			}
		}
	}()
}

// cleanupOldHistory deletes webhook history records older than 7 days
func (s *Service) cleanupOldHistory(ctx context.Context) {
	if s.historyRepo == nil {
		return
	}

	logger.Info("Starting webhook history cleanup", "service", "integration")

	// Delete records older than 7 days
	deleted, err := s.historyRepo.DeleteOldWebhookHistory(ctx, 7*24*time.Hour)
	if err != nil {
		logger.Error("Failed to cleanup old webhook history",
			"service", "integration",
			"error", err,
		)
		return
	}

	if deleted > 0 {
		logger.Info("Webhook history cleanup completed",
			"service", "integration",
			"deleted_records", deleted,
		)
	}
}
