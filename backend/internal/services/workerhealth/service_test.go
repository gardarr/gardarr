package workerhealth

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jfxdev/gardarr/internal/entities"
	workerrepository "github.com/jfxdev/gardarr/internal/repository/worker"
)

// fakeProber implements prober with a scriptable per-call outcome.
type fakeProber struct {
	mu    sync.Mutex
	calls int
	// outcomes[i] is the result of the i-th call to GetInstance, clamped to
	// the last entry once exhausted so tests can express "stays failing".
	outcomes []error
	// blockCh, if set, makes GetInstance wait to be released - used to widen
	// the race window in concurrency tests.
	blockCh chan struct{}
	// entered, if set, is closed the moment GetInstance is called (before
	// waiting on blockCh), so a test can synchronize on "the probe has
	// actually started" instead of guessing with a fixed sleep.
	entered   chan struct{}
	enterOnce sync.Once
}

func (f *fakeProber) ListWorkers() ([]*entities.Worker, error) { return nil, nil }

func (f *fakeProber) GetInstance(worker *entities.Worker) (*entities.Instance, error) {
	if f.entered != nil {
		f.enterOnce.Do(func() { close(f.entered) })
	}
	if f.blockCh != nil {
		<-f.blockCh
	}

	f.mu.Lock()
	defer f.mu.Unlock()
	if len(f.outcomes) == 0 {
		return nil, errors.New("fakeProber: no outcomes configured")
	}
	idx := f.calls
	if idx >= len(f.outcomes) {
		idx = len(f.outcomes) - 1
	}
	f.calls++
	err := f.outcomes[idx]
	if err != nil {
		return nil, err
	}
	return &entities.Instance{}, nil
}

// fakeEvents records every event passed to Record.
type fakeEvents struct {
	mu     sync.Mutex
	events []*entities.Event
}

func (f *fakeEvents) Record(_ context.Context, event *entities.Event) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.events = append(f.events, event)
	return nil
}

func (f *fakeEvents) types() []string {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make([]string, len(f.events))
	for i, e := range f.events {
		out[i] = e.Type
	}
	return out
}

func newTestService(repo prober, ev eventRecorder) *Service {
	return &Service{
		repository:  repo,
		eventSvc:    ev,
		readTimeout: time.Second,
		health:      make(map[uuid.UUID]*Health),
	}
}

func TestRefreshBelowThresholdDoesNotConfirmErrored(t *testing.T) {
	connErr := &workerrepository.WorkerError{Code: entities.WorkerErrorCodeConnectionRefused}
	repo := &fakeProber{outcomes: []error{connErr, connErr}}
	events := &fakeEvents{}
	svc := newTestService(repo, events)
	worker := &entities.Worker{UUID: uuid.New()}

	svc.Refresh(worker)
	h1, _ := svc.Get(worker.UUID)
	if h1.Status != entities.WorkerStatusPending {
		t.Fatalf("after 1 failure, expected PENDING, got %s", h1.Status)
	}

	svc.Refresh(worker)
	h2, _ := svc.Get(worker.UUID)
	if h2.Status != entities.WorkerStatusPending {
		t.Fatalf("after 2 failures (below threshold %d), expected still PENDING, got %s", consecutiveFailThreshold, h2.Status)
	}

	if len(events.types()) != 0 {
		t.Fatalf("expected no transition event below threshold, got %v", events.types())
	}
}

func TestRefreshConfirmsErroredAtThresholdAndFiresOfflineEvent(t *testing.T) {
	connErr := &workerrepository.WorkerError{Code: entities.WorkerErrorCodeConnectionRefused}
	repo := &fakeProber{outcomes: []error{nil, connErr, connErr, connErr}}
	events := &fakeEvents{}
	svc := newTestService(repo, events)
	worker := &entities.Worker{UUID: uuid.New()}

	svc.Refresh(worker) // success -> ACTIVE, no event (PENDING -> ACTIVE is not a transition)
	if got := events.types(); len(got) != 0 {
		t.Fatalf("expected no event on first successful probe, got %v", got)
	}

	svc.Refresh(worker) // fail 1
	svc.Refresh(worker) // fail 2
	if h, _ := svc.Get(worker.UUID); h.Status != entities.WorkerStatusActive {
		t.Fatalf("below threshold, expected cached status to stay ACTIVE, got %s", h.Status)
	}

	svc.Refresh(worker) // fail 3 - crosses threshold
	h, ok := svc.Get(worker.UUID)
	if !ok || h.Status != entities.WorkerStatusErrored {
		t.Fatalf("expected ERRORED after %d consecutive failures, got %s", consecutiveFailThreshold, h.Status)
	}
	if h.Instance != nil {
		t.Fatalf("expected Instance cleared on confirmed error")
	}

	types := events.types()
	if len(types) != 1 || types[0] != "worker.offline" {
		t.Fatalf("expected exactly one worker.offline event, got %v", types)
	}
}

func TestRefreshRecoversOnFirstSuccessAfterConfirmedErrored(t *testing.T) {
	connErr := &workerrepository.WorkerError{Code: entities.WorkerErrorCodeConnectionRefused}
	repo := &fakeProber{outcomes: []error{connErr, connErr, connErr, nil}}
	events := &fakeEvents{}
	svc := newTestService(repo, events)
	worker := &entities.Worker{UUID: uuid.New()}

	for range 3 {
		svc.Refresh(worker)
	}
	if h, _ := svc.Get(worker.UUID); h.Status != entities.WorkerStatusErrored {
		t.Fatalf("setup: expected ERRORED before recovery, got %s", h.Status)
	}

	svc.Refresh(worker) // single success recovers immediately, no dampening on the way up
	h, _ := svc.Get(worker.UUID)
	if h.Status != entities.WorkerStatusActive {
		t.Fatalf("expected ACTIVE after one successful probe, got %s", h.Status)
	}

	types := events.types()
	if len(types) != 2 || types[0] != "worker.offline" || types[1] != "worker.recovered" {
		t.Fatalf("expected [worker.offline, worker.recovered], got %v", types)
	}
}

func TestInitializingIsNotAnOutage(t *testing.T) {
	startingUp := &workerrepository.WorkerError{Code: entities.WorkerErrorCodeServiceUnavailable, Message: "server is starting up"}
	repo := &fakeProber{outcomes: []error{startingUp, startingUp, startingUp, startingUp}}
	events := &fakeEvents{}
	svc := newTestService(repo, events)
	worker := &entities.Worker{UUID: uuid.New()}

	for range 4 {
		svc.Refresh(worker)
	}

	h, _ := svc.Get(worker.UUID)
	if h.Status != entities.WorkerStatusInitializing {
		t.Fatalf("expected INITIALIZING regardless of repeat count, got %s", h.Status)
	}
	if len(events.types()) != 0 {
		t.Fatalf("expected no transition event for INITIALIZING, got %v", events.types())
	}
}

func TestGetReturnsNotOKForUnknownWorker(t *testing.T) {
	svc := newTestService(&fakeProber{}, nil)
	if _, ok := svc.Get(uuid.New()); ok {
		t.Fatalf("expected ok=false for a worker with no completed probe")
	}
}

func TestSeedAppliesImmediatelyWithoutDampening(t *testing.T) {
	events := &fakeEvents{}
	svc := newTestService(&fakeProber{}, events)
	workerID := uuid.New()

	connErr := &workerrepository.WorkerError{Code: entities.WorkerErrorCodeAuthFailure, Permanent: true}
	h := svc.Seed(workerID, nil, connErr)
	if h.Status != entities.WorkerStatusErrored || !h.Permanent {
		t.Fatalf("expected a single Seed failure to confirm ERRORED immediately, got status=%s permanent=%v", h.Status, h.Permanent)
	}
	if types := events.types(); len(types) != 1 || types[0] != "worker.offline" {
		t.Fatalf("expected one worker.offline event from Seed, got %v", types)
	}

	h = svc.Seed(workerID, &entities.Instance{}, nil)
	if h.Status != entities.WorkerStatusActive {
		t.Fatalf("expected ACTIVE after successful Seed, got %s", h.Status)
	}
	if types := events.types(); len(types) != 2 || types[1] != "worker.recovered" {
		t.Fatalf("expected worker.recovered appended, got %v", types)
	}
}

// slowProber blocks longer than any reasonable test readTimeout before
// returning success, to exercise the read-timeout path itself rather than
// the flap-dampening state machine.
type slowProber struct {
	delay time.Duration
}

func (p slowProber) ListWorkers() ([]*entities.Worker, error) { return nil, nil }
func (p slowProber) GetInstance(*entities.Worker) (*entities.Instance, error) {
	time.Sleep(p.delay)
	return &entities.Instance{}, nil
}

func TestReadTimeoutClassifiesSlowProbeAsTimeout(t *testing.T) {
	svc := &Service{
		repository:  slowProber{delay: 50 * time.Millisecond},
		readTimeout: 5 * time.Millisecond,
		health:      make(map[uuid.UUID]*Health),
	}
	worker := &entities.Worker{UUID: uuid.New()}

	instance, err := svc.probeWithTimeout(worker)
	if err == nil {
		t.Fatalf("expected a timeout error, got instance=%v", instance)
	}
	code, _ := extractWorkerError(err)
	if code != entities.WorkerErrorCodeTimeout {
		t.Fatalf("expected WorkerErrorCodeTimeout, got %s (%v)", code, err)
	}
}

// TestRefreshDedupesConcurrentCallsForSameWorker guards against the bug
// that made ListWorkers/GetWorker feel stuck on the frontend: before
// singleflight, every concurrent on-demand caller for an unconfirmed
// worker paid its own full readTimeout wait instead of sharing one probe.
func TestRefreshDedupesConcurrentCallsForSameWorker(t *testing.T) {
	block := make(chan struct{})
	entered := make(chan struct{})
	repo := &fakeProber{outcomes: []error{nil}, blockCh: block, entered: entered}
	svc := newTestService(repo, nil)
	worker := &entities.Worker{UUID: uuid.New()}

	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		svc.Refresh(worker)
	}()
	// Wait for the leader call to actually enter GetInstance and start
	// waiting on blockCh before the followers join the same in-flight key.
	<-entered

	const followers = 5
	wg.Add(followers)
	for range followers {
		go func() {
			defer wg.Done()
			svc.Refresh(worker)
		}()
	}
	time.Sleep(20 * time.Millisecond)
	close(block)
	wg.Wait()

	repo.mu.Lock()
	calls := repo.calls
	repo.mu.Unlock()
	if calls != 1 {
		t.Fatalf("expected exactly 1 underlying probe for %d concurrent Refresh calls, got %d", followers+1, calls)
	}
}

func TestDeleteEvictsCacheEntry(t *testing.T) {
	svc := newTestService(&fakeProber{}, nil)
	workerID := uuid.New()
	svc.Seed(workerID, &entities.Instance{}, nil)

	if _, ok := svc.Get(workerID); !ok {
		t.Fatalf("setup: expected cache entry after Seed")
	}

	svc.Delete(workerID)

	if _, ok := svc.Get(workerID); ok {
		t.Fatalf("expected cache entry evicted after Delete")
	}
}
