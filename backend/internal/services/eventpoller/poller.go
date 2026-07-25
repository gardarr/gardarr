package eventpoller

import (
	"context"
	"sync"
	"time"

	"github.com/jfxdev/gardarr/internal/entities"
	"github.com/jfxdev/gardarr/internal/services/events"
	"github.com/jfxdev/gardarr/internal/services/workermanager"
	"github.com/jfxdev/gardarr/pkg/env"
	"github.com/jfxdev/gardarr/pkg/logger"
)

// Service periodically polls active workers for task state changes and feeds the
// events system. This replaces the event-tracking that was previously embedded
// inside the statistics collection loop.
type Service struct {
	workers      *workermanager.Service
	eventService *events.Service
	interval     time.Duration
}

// NewService creates a new event poller.
func NewService(workers *workermanager.Service, eventService *events.Service) *Service {
	return &Service{
		workers:      workers,
		eventService: eventService,
		interval:     env.Get("EVENT_POLL_INTERVAL").Default("30s").ValueDuration(),
	}
}

// Start begins the periodic polling loop. It stops when ctx is canceled.
func (s *Service) Start(ctx context.Context) {
	ticker := time.NewTicker(s.interval)
	go func() {
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				s.pollOnce(ctx)
			case <-ctx.Done():
				return
			}
		}
	}()
}

func (s *Service) pollOnce(ctx context.Context) {
	// ListWorkersBasic skips the per-worker login/health-check ListWorkers
	// performs; an unreachable worker simply fails ListTasks in pollWorker,
	// so probing availability upfront on every poll cycle bought nothing.
	workers, err := s.workers.ListWorkersBasic()
	if err != nil || len(workers) == 0 {
		return
	}

	now := time.Now().UTC()

	var wg sync.WaitGroup
	for _, worker := range workers {
		wg.Add(1)
		go func(w *entities.Worker) {
			defer wg.Done()
			s.pollWorker(ctx, w, now)
		}(worker)
	}
	wg.Wait()
}

func (s *Service) pollWorker(ctx context.Context, w *entities.Worker, now time.Time) {
	result, err := s.workers.ListTasks(ctx, []*entities.Worker{w})
	if err != nil {
		logger.Debug("event poller: failed to list tasks",
			"worker_id", w.UUID.String(),
			"error", err.Error(),
		)
		return
	}
	tasks := result.Tasks
	if len(tasks) == 0 {
		return
	}

	if err := s.eventService.TrackTasks(ctx, tasks, w.UUID, now); err != nil {
		logger.Debug("event poller: track tasks error",
			"worker_id", w.UUID.String(),
			"error", err.Error(),
		)
	}
	if err := s.eventService.DetectRemovedTasks(ctx, tasks, w.UUID, now); err != nil {
		logger.Debug("event poller: detect removed tasks error",
			"worker_id", w.UUID.String(),
			"error", err.Error(),
		)
	}
}
