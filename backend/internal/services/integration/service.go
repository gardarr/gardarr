package integration

import (
	"context"
	"sync"
	"time"

	"github.com/jfxdev/gardarr/internal/entities"
	"github.com/jfxdev/gardarr/internal/infra/database"
	"github.com/jfxdev/gardarr/internal/repository/webhook"
	"github.com/jfxdev/gardarr/internal/repository/webhook_history"
	webhookService "github.com/jfxdev/gardarr/internal/services/integration/webhook"
	"github.com/jfxdev/gardarr/pkg/filters"
	"github.com/jfxdev/gardarr/pkg/logger"
)

// Service manages integration events from the events system
type Service struct {
	enabled         bool
	eventChan       <-chan *entities.Event
	webhookRepo     *webhook.Repository
	historyRepo     *webhook_history.Repository
	webhookServices map[string]*webhookService.Service
	webhookFilters  map[string]*entities.EventFilter // Maps webhook UUID to its filter
	mu              sync.RWMutex
}

// NewService creates a new integration service that consumes events
// from the provided channel and decides whether to forward them to webhooks
// or other integrations based on configuration
func NewService(eventChan <-chan *entities.Event, db *database.Database) *Service {
	return &Service{
		enabled:         true,
		eventChan:       eventChan,
		webhookRepo:     webhook.NewRepository(db),
		historyRepo:     webhook_history.NewRepository(db),
		webhookServices: make(map[string]*webhookService.Service),
		webhookFilters:  make(map[string]*entities.EventFilter),
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

// loadWebhooks loads all enabled webhooks from the database and creates webhook services
func (s *Service) loadWebhooks(ctx context.Context) {
	webhooks, err := s.webhookRepo.ListEnabledWebhooks(ctx)
	if err != nil {
		logger.Error("Failed to load webhooks",
			"service", "integration",
			"error", err,
		)
		return
	}

	// Clear existing services and filters
	s.mu.Lock()
	defer s.mu.Unlock()

	s.webhookServices = make(map[string]*webhookService.Service)
	s.webhookFilters = make(map[string]*entities.EventFilter)

	// Create new services for each webhook
	for _, wh := range webhooks {
		service := webhookService.NewService(wh.UUID, wh.URL, wh.InsecureSkipVerify, wh.TimeoutSeconds, s.historyRepo)
		webhookID := wh.UUID.String()
		s.webhookServices[webhookID] = service

		// Store filter if present
		if wh.Filter != nil {
			s.webhookFilters[webhookID] = wh.Filter
		}

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

// ReloadWebhooks reloads all webhooks from the database
// This should be called after creating, updating, or deleting webhooks
func (s *Service) ReloadWebhooks(ctx context.Context) {
	s.loadWebhooks(ctx)
}

// webhookTarget holds webhook service reference and its filter for event processing
type webhookTarget struct {
	id     string
	svc    *webhookService.Service
	filter *entities.EventFilter
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

// getWebhookTargets returns a snapshot of current webhook services and their filters
func (s *Service) getWebhookTargets() []webhookTarget {
	s.mu.RLock()
	defer s.mu.RUnlock()

	targets := make([]webhookTarget, 0, len(s.webhookServices))
	for id, svc := range s.webhookServices {
		targets = append(targets, webhookTarget{
			id:     id,
			svc:    svc,
			filter: s.webhookFilters[id],
		})
	}
	return targets
}

// sendEventToWebhook checks if event matches filter and sends it to the webhook
func (s *Service) sendEventToWebhook(ctx context.Context, event *entities.Event, target webhookTarget) {
	if target.svc == nil || !target.svc.Enabled() {
		return
	}

	if !filters.MatchesEvent(target.filter, event) {
		logger.Debug("Event filtered out for webhook",
			"service", "integration",
			"event_id", event.UUID.String(),
			"webhook_id", target.id,
			"event_type", event.Type,
			"new_value", event.NewValue,
		)
		return
	}

	logger.Debug("Event matches filter, sending to webhook",
		"service", "integration",
		"event_id", event.UUID.String(),
		"webhook_id", target.id,
	)

	if err := target.svc.SendEvent(ctx, event); err != nil {
		logger.Error("Failed to send event to webhook",
			"service", "integration",
			"event_id", event.UUID.String(),
			"webhook_id", target.id,
			"error", err,
		)
	}
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

	for _, target := range targets {
		s.sendEventToWebhook(ctx, event, target)
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
