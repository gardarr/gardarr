// Package workerhealth probes registered workers on its own background
// cadence and caches the result, so callers that need worker status or
// instance data (workermanager's ListWorkers/ListTasks) never block on a
// live qBittorrent round trip. Status is the single source of truth for
// worker health and is the base for the WORKER_STATUS_CHANGED websocket
// event and worker.offline/worker.recovered alerting events.
package workerhealth

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jfxdev/gardarr/internal/constants"
	"github.com/jfxdev/gardarr/internal/entities"
	workerrepository "github.com/jfxdev/gardarr/internal/repository/worker"
	"github.com/jfxdev/gardarr/pkg/env"
	"github.com/jfxdev/gardarr/pkg/logger"
	"golang.org/x/sync/singleflight"
)

// consecutiveFailThreshold is how many consecutive failed background probes
// a worker must accumulate before it is confirmed ERRORED and a
// worker.offline event is recorded. Below this threshold a transient blip
// stays invisible to callers (cached Status/Error/Instance untouched), so
// one flaky probe doesn't spam every configured webhook or flicker the UI.
const consecutiveFailThreshold = 3

// prober is the narrow slice of workerrepository.RepositoryInterface this
// package needs. Declaring it locally (rather than depending on the full
// interface) keeps the probe loop testable with a small fake instead of a
// stub implementing every worker repository method.
type prober interface {
	ListWorkers() ([]*entities.Worker, error)
	GetInstance(worker *entities.Worker) (*entities.Instance, error)
}

// eventRecorder is the narrow slice of events.Service this package needs,
// following the same pattern as bandwidthscheduler.eventRecorder - keeps
// transition-event tests fake-able without a real database.
type eventRecorder interface {
	Record(ctx context.Context, event *entities.Event) error
}

// Health is the cached outcome of the most recent confirmed probe for one
// worker. Instance is nil unless Status is ACTIVE. It is treated as
// read-only once placed in the cache: concurrent callers share the same
// pointer, so nothing may mutate a returned Instance in place.
type Health struct {
	Status           string
	ErrorCode        entities.WorkerErrorCode
	Error            string
	Permanent        bool
	Instance         *entities.Instance
	LastCheckedAt    time.Time
	LastTransitionAt time.Time

	consecutiveFails int
}

// Service owns the in-memory health cache and the background probe loop.
type Service struct {
	repository  prober
	eventSvc    eventRecorder
	interval    time.Duration
	readTimeout time.Duration

	mu     sync.RWMutex
	health map[uuid.UUID]*Health

	// sf collapses concurrent Refresh calls for the same worker (a
	// background tick and one or more on-demand ListWorkers/GetWorker
	// fallbacks racing each other) into a single in-flight probe, so N
	// simultaneous callers each pay one readTimeout wait, not N of them
	// serially re-dialing the same unreachable worker.
	sf singleflight.Group
}

// NewService creates a worker health service. repository only needs to
// satisfy prober (ListWorkers + GetInstance); callers typically pass the
// full workerrepository.RepositoryInterface. eventSvc only needs to satisfy
// eventRecorder; callers typically pass a real *events.Service. eventSvc
// may be a literal nil - deliberately typed as the interface rather than
// *events.Service so passing nil doesn't fall into Go's "non-nil interface
// wrapping a nil pointer" trap in tests that don't care about events.
func NewService(repository prober, eventSvc eventRecorder) *Service {
	return &Service{
		repository:  repository,
		eventSvc:    eventSvc,
		interval:    env.Get("WORKER_HEALTH_INTERVAL").Default("15s").ValueDuration(),
		readTimeout: env.Get("WORKER_HEALTH_READ_TIMEOUT").Default("5s").ValueDuration(),
		health:      make(map[uuid.UUID]*Health),
	}
}

// defaultInterval is used by Start when s.interval is zero or negative
// (env.Get's Default doesn't parse a malformed value, so a bad
// WORKER_HEALTH_INTERVAL could otherwise reach time.NewTicker, which panics
// on a non-positive duration).
const defaultInterval = 15 * time.Second

// Start begins the periodic probing loop. It stops when ctx is canceled.
func (s *Service) Start(ctx context.Context) {
	interval := s.interval
	if interval <= 0 {
		interval = defaultInterval
	}
	ticker := time.NewTicker(interval)
	go func() {
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				s.probeAll()
			case <-ctx.Done():
				return
			}
		}
	}()
}

func (s *Service) probeAll() {
	workers, err := s.repository.ListWorkers()
	if err != nil {
		logger.Error("worker health: failed to list workers", "error", err.Error())
		return
	}

	var wg sync.WaitGroup
	for _, w := range workers {
		wg.Add(1)
		go func(w *entities.Worker) {
			defer wg.Done()
			s.Refresh(w)
		}(w)
	}
	wg.Wait()
}

// Refresh synchronously probes w now, bounded by WORKER_HEALTH_READ_TIMEOUT,
// and updates the cache. Used by the background loop and as an on-demand
// fallback for a worker whose health isn't confirmed yet (e.g. right after
// boot, before its first scheduled probe completes) so callers - including
// ListWorkers/GetWorker falling back synchronously - don't block on however
// long the worker takes to answer (or fail to). Concurrent calls for the
// same worker (a tick racing one or more on-demand callers) share a single
// probe via singleflight instead of each independently dialing and waiting
// out their own readTimeout - without this, a burst of requests hitting an
// unconfirmed worker (e.g. several page components each fetching worker
// data right after boot) would each stall for readTimeout in turn, and the
// page would feel stuck far longer than the bound was meant to allow.
func (s *Service) Refresh(w *entities.Worker) Health {
	v, _, _ := s.sf.Do(w.UUID.String(), func() (interface{}, error) {
		instance, err := s.probeWithTimeout(w)
		return s.record(w.UUID, instance, err), nil
	})
	return v.(Health)
}

// probeWithTimeout calls repository.GetInstance but gives up waiting after
// readTimeout. repository.GetInstance doesn't accept a context to cancel
// the underlying HTTP call, so a timed-out probe keeps running in the
// background against qBittorrent's own (longer) WORKER_TIMEOUT_SECONDS
// bound - only this call's result is discarded; the goroutine simply exits
// once it eventually completes.
func (s *Service) probeWithTimeout(w *entities.Worker) (*entities.Instance, error) {
	type outcome struct {
		instance *entities.Instance
		err      error
	}

	resultCh := make(chan outcome, 1)
	go func() {
		instance, err := s.repository.GetInstance(w)
		resultCh <- outcome{instance, err}
	}()

	select {
	case r := <-resultCh:
		return r.instance, r.err
	case <-time.After(s.readTimeout):
		return nil, &workerrepository.WorkerError{
			Code:    entities.WorkerErrorCodeTimeout,
			Message: fmt.Sprintf("worker health check timed out after %s", s.readTimeout),
		}
	}
}

// Seed records an externally-obtained, high-confidence probe result (e.g.
// from CreateWorker's pre-persist connectivity check, or UpdateWorker's
// best-effort post-update check) without performing a new network call.
// Unlike the background loop's Refresh, Seed applies immediately without
// flap-dampening: it reflects a deliberate, explicit user action rather
// than an unattended periodic check, so there's no flakiness to guard
// against.
func (s *Service) Seed(workerID uuid.UUID, instance *entities.Instance, probeErr error) Health {
	now := time.Now().UTC()

	s.mu.Lock()
	h := s.entryLocked(workerID)
	prevStatus := h.Status
	h.LastCheckedAt = now
	h.consecutiveFails = 0

	if probeErr == nil {
		h.Status = entities.WorkerStatusActive
		h.ErrorCode = entities.WorkerErrorCodeNone
		h.Error = ""
		h.Permanent = false
		h.Instance = instance
	} else {
		status, code, permanent := classifyProbeError(probeErr)
		h.Status = status
		h.ErrorCode = code
		h.Error = probeErr.Error()
		h.Permanent = permanent
		h.Instance = nil
	}
	if h.Status != prevStatus {
		h.LastTransitionAt = now
	}
	result := *h
	s.mu.Unlock()

	s.notifyTransition(workerID, prevStatus, result)
	return result
}

// record applies a background probe outcome with flap dampening: a failure
// only becomes visible (Status/Error/Instance updated, transition event
// fired) once it has repeated consecutiveFailThreshold times in a row.
// INITIALIZING is never dampened or counted as a failure - it's a real-time
// state, not an outage.
func (s *Service) record(workerID uuid.UUID, instance *entities.Instance, probeErr error) Health {
	now := time.Now().UTC()

	s.mu.Lock()
	h := s.entryLocked(workerID)
	prevStatus := h.Status
	h.LastCheckedAt = now

	if probeErr == nil {
		h.consecutiveFails = 0
		h.Status = entities.WorkerStatusActive
		h.ErrorCode = entities.WorkerErrorCodeNone
		h.Error = ""
		h.Permanent = false
		h.Instance = instance
		if h.Status != prevStatus {
			h.LastTransitionAt = now
		}
		result := *h
		s.mu.Unlock()
		s.notifyTransition(workerID, prevStatus, result)
		return result
	}

	status, code, permanent := classifyProbeError(probeErr)
	if status == entities.WorkerStatusInitializing {
		h.consecutiveFails = 0
		h.Status = status
		h.ErrorCode = code
		h.Error = probeErr.Error()
		h.Permanent = permanent
		h.Instance = nil
		if h.Status != prevStatus {
			h.LastTransitionAt = now
		}
		result := *h
		s.mu.Unlock()
		s.notifyTransition(workerID, prevStatus, result)
		return result
	}

	h.consecutiveFails++
	if h.consecutiveFails < consecutiveFailThreshold {
		// Not confirmed yet: leave the externally-visible state untouched.
		result := *h
		s.mu.Unlock()
		return result
	}

	h.Status = entities.WorkerStatusErrored
	h.ErrorCode = code
	h.Error = probeErr.Error()
	h.Permanent = permanent
	h.Instance = nil
	if h.Status != prevStatus {
		h.LastTransitionAt = now
	}
	result := *h
	s.mu.Unlock()
	s.notifyTransition(workerID, prevStatus, result)
	return result
}

// entryLocked returns the cache entry for workerID, creating it as PENDING
// (unknown) if absent. Callers must hold s.mu.
func (s *Service) entryLocked(workerID uuid.UUID) *Health {
	h, ok := s.health[workerID]
	if !ok {
		h = &Health{Status: entities.WorkerStatusPending}
		s.health[workerID] = h
	}
	return h
}

// notifyTransition records a worker.offline/worker.recovered event when
// prevStatus -> result.Status confirms a worker going down or coming back.
// A worker going ERRORED is newsworthy regardless of what it was confirmed
// as before (ACTIVE, PENDING/never-successfully-probed, or INITIALIZING) -
// each means "wasn't known to be down, now is". Recovery only fires from a
// confirmed ERRORED, so INITIALIZING settling into ACTIVE on first boot
// isn't reported as a "recovery" from anything.
func (s *Service) notifyTransition(workerID uuid.UUID, prevStatus string, result Health) {
	if s.eventSvc == nil || prevStatus == result.Status {
		return
	}

	var eventType, oldValue, newValue string
	switch {
	case result.Status == entities.WorkerStatusErrored && prevStatus != entities.WorkerStatusErrored:
		eventType, oldValue, newValue = constants.EventTypeWorkerOffline, "ONLINE", "OFFLINE"
	case result.Status == entities.WorkerStatusActive && prevStatus == entities.WorkerStatusErrored:
		eventType, oldValue, newValue = constants.EventTypeWorkerRecovered, "OFFLINE", "ONLINE"
	default:
		return
	}

	if err := s.eventSvc.Record(context.Background(), &entities.Event{
		WorkerID: workerID,
		Type:     eventType,
		OldValue: oldValue,
		NewValue: newValue,
		Metadata: map[string]interface{}{
			"status":     result.Status,
			"error":      result.Error,
			"error_code": string(result.ErrorCode),
			"permanent":  result.Permanent,
		},
	}); err != nil {
		logger.Error("worker health: failed to record transition event",
			"worker_id", workerID.String(),
			"event_type", eventType,
			"error", err.Error(),
		)
	}
}

// classifyProbeError maps a probe error into the status/code/permanent
// triple used to populate Health, including the INITIALIZING special case
// (qBittorrent reachable but still starting up - not an outage). A 503 is
// treated as INITIALIZING unconditionally: qBittorrent's WebUI returns it
// with an empty body while starting up, so gating on a "starting up"
// substring in the error message missed the common case entirely.
func classifyProbeError(err error) (status string, code entities.WorkerErrorCode, permanent bool) {
	code, permanent = extractWorkerError(err)
	status = entities.WorkerStatusErrored
	if code == entities.WorkerErrorCodeServiceUnavailable {
		status = entities.WorkerStatusInitializing
	}
	return status, code, permanent
}

// extractWorkerError extracts error code and permanent flag from an error.
// Returns WorkerErrorCodeUnknown and false if the error is not a
// *workerrepository.WorkerError. Supports wrapped errors via errors.As.
func extractWorkerError(err error) (entities.WorkerErrorCode, bool) {
	var workerErr *workerrepository.WorkerError
	if errors.As(err, &workerErr) {
		return workerErr.Code, workerErr.Permanent
	}
	return entities.WorkerErrorCodeUnknown, false
}

// Get returns the cached health for workerID. ok is false if no probe has
// ever completed for this worker (true cache miss, distinct from PENDING
// which means a probe ran but hasn't confirmed a status yet).
func (s *Service) Get(workerID uuid.UUID) (Health, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	h, ok := s.health[workerID]
	if !ok {
		return Health{}, false
	}
	return *h, true
}

// Delete evicts workerID's cache entry. Call this when a worker is deleted
// so a stale entry doesn't linger (mirrors the worker repository evicting
// its cached qbt client on delete).
func (s *Service) Delete(workerID uuid.UUID) {
	s.mu.Lock()
	delete(s.health, workerID)
	s.mu.Unlock()
}

// Snapshot returns a copy of the current health cache keyed by worker ID,
// for a newly connected websocket client to catch up on current state.
func (s *Service) Snapshot() map[uuid.UUID]Health {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make(map[uuid.UUID]Health, len(s.health))
	for id, h := range s.health {
		out[id] = *h
	}
	return out
}
