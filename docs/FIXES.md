# Pending performance/stability fixes

Status snapshot as of 2026-07-22. Companion to the full backend+frontend review
done earlier in this effort. Items already implemented (client caching /
goroutine leak fix in `go-qbt`, webhook per-worker queues, batched task-state
upserts, route-level lazy loading, debounced history search, per-route error
boundaries, AuthContext memoization, WorkerLogsTab retry loop, `api.ts`
timeout/AbortSignal support, `React.memo` on torrent row components) are not
repeated here. This file only tracks what's still open.

---

## Backend

### 1. `GetWorkerTasksStats` fetches the task list twice

**File:** `backend/internal/services/workermanager/service.go:594-624`

```go
func (s *Service) GetWorkerTasksStats(ctx context.Context, id string) (*entities.TaskStats, error) {
	worker, err := s.fetchWorker(id)
	...
	stats, err := s.repository.GetWorkerTasksStats(worker)   // <- fetches all tasks internally
	...
	allTasks, err := s.repository.ListWorkerTasks(worker)     // <- fetches all tasks AGAIN
	...
	stats.TotalTasksCount = len(allTasks)
	stats.TotalDiskSize = totalDiskSize   // recomputed from allTasks
	stats.WordCloud = s.calculateWordCloud(allTasks)
	return stats, nil
}
```

`repository.GetWorkerTasksStats` (`backend/internal/repository/worker/repository.go:292`)
delegates to `taskservice.New(client).GetTasksStats(ctx)`
(`backend/internal/services/task/worker/service.go:122-145`), which already
calls `s.repository.List()` once and computes `TotalTasksCount`,
`TotalDiskSize`, and `WordCloud` (`calculateWordCloud(tasks)`) from that same
list. The workermanager-level function then throws those fields away and
refetches the entire task list a second time just to recompute the exact
same three fields.

**Impact:** every "get worker stats" call (used by the dashboard) does two
full `/api/v2/torrents/info`-equivalent round trips to qBittorrent instead of
one. With client caching now in place this no longer means two logins, but
it's still double the request latency and double the qBittorrent server load
for no reason.

**Fix:** delete the second `ListWorkerTasks` call and the
recomputation block; `repository.GetWorkerTasksStats` already returns
correct `TotalTasksCount`/`TotalDiskSize`/`WordCloud`. If
`entities.TaskStats` needs a field that only the workermanager-level call
computes today, move that computation into `taskservice.GetTasksStats`
instead of re-fetching.

---

### 2. SQLite has no WAL mode / busy-timeout tuning

**File:** `backend/internal/infra/database/database.go:57-68`

```go
case constants.DatabaseDriverSQLite:
	if err := ensureSQLiteFile(config.filePath); err != nil {
		return nil, fmt.Errorf("failed to create SQLite database file: %w", err)
	}
	db, err = gorm.Open(sqlite.Open(config.filePath), &gorm.Config{
		Logger: gormLogger,
	})
```

No `PRAGMA journal_mode=WAL`, no `PRAGMA busy_timeout`, and no explicit
`SetMaxOpenConns` for the SQLite branch (only the Postgres branch at
lines 74-89 configures the pool). Default SQLite journal mode is rollback
journal, which blocks all readers while a write transaction is in progress.
Combined with the batched task-state upsert now running every poll cycle
(`internal/services/events/service.go`), concurrent reads (API requests
listing torrents/history while a poll write is in flight) can hit
`SQLITE_BUSY`/lock contention more than necessary.

**Fix:**
```go
db, err = gorm.Open(sqlite.Open(config.filePath), &gorm.Config{Logger: gormLogger})
if err == nil {
	err = db.Exec("PRAGMA journal_mode=WAL;").Error
}
if err == nil {
	err = db.Exec("PRAGMA busy_timeout=5000;").Error
}
```
WAL mode allows readers to proceed concurrently with a single writer instead
of blocking. Also consider `sqlDB.SetMaxOpenConns(1)` for SQLite explicitly
(currently unset, relying on Go's default pool, which can open multiple
connections against a single SQLite file and increases `SQLITE_BUSY` risk
even under WAL for writers).

---

### 3. No concurrency cap on per-worker goroutine bursts

**File:** `backend/internal/services/workermanager/service.go:84-145` (`ListWorkers`) and `184-233` (`ListTasks`)

Both spawn one goroutine per registered worker with no upper bound. Harmless
today (qBittorrent management deployments rarely register more than a
handful of instances), but there's no defensive cap — if a user registers
dozens of workers, every `ListWorkers()`/`ListTasks()` call bursts that many
concurrent outbound HTTP logins/requests simultaneously.

**Fix (low priority):** bound with a semaphore (buffered channel of size
N, e.g. 20) or `golang.org/x/sync/errgroup` with `SetLimit`. Only worth doing
if/when worker counts are expected to grow past what a single burst can
comfortably handle.

---

### 4. `buildBaseMetadata` allocates a fresh map + JSON marshal per task per poll

**File:** `backend/internal/services/events/service.go` (`buildBaseMetadata`, `buildStateChangeMetadata`, `buildCompletionCheck`)

Each call builds a new `map[string]interface{}` (reflection-heavy boxing) and
that map gets JSON-marshaled downstream when the event is persisted. Not a
measurable hotspot at current scale, but if poll frequency increases or
tracked-torrent counts grow into the thousands, this allocation pattern will
show up in profiles.

**Fix (cosmetic/low priority):** only worth revisiting if profiling actually
shows GC pressure from this path. No action needed now.

---

## Frontend

### 5. Torrent handlers in `Torrents.tsx` still recreate on every render

**File:** `frontend/src/Torrents.tsx` (e.g. `handlePlayTorrent`, `handlePauseTorrent`,
`handleForceDownloadTorrent`, `handleForceReannounceTorrent`,
`handleForceRecheckTorrent`, `handleShowDetails`, `handleOpenMetadataSearch`,
`handleShowLimits`, `handleDeleteTorrent`, `openDeleteModal` — lines ~349-582)

The `React.memo` wrapping already applied to `TorrentRow` / `TorrentCompactRow`
/ `TorrentCard` (see done-items above) has limited effect here because these
handlers are plain closures (not `useCallback`) that read `originalTasks`,
`torrents`, `lastNonEmptyTorrents`, `selectionMode`, `selectedIds` directly
from component state. Since `originalTasks`/`torrents` are rebuilt on every
WebSocket-driven update (every few seconds under normal use), the handlers —
and therefore the `actions`/`selection` objects built from them in
`TorrentsTable.tsx` / `TorrentListCompact.tsx` / `TorrentCard.tsx` — get new
identities on every such update, which still forces every row to re-render
even though `React.memo` is in place.

**Why this wasn't done in the same pass:** properly fixing it means either:
- (a) introducing a ref that always holds the latest `originalTasks` /
  `torrents` / `lastNonEmptyTorrents` / `selectionMode` / `selectedIds`
  (assigned during render, not in a `useEffect`, so it's current by the time
  any event handler runs), and rewriting the handlers above to read from the
  ref instead of the state closures, wrapped in `useCallback` with stable
  (empty or near-empty) dependency arrays; or
- (b) making `mapTaskToTorrent` referentially stable across polls (only
  create a new object for a torrent whose fields actually changed instead of
  mapping the entire task list into brand-new objects every time).

Both are legitimate fixes but touch a ~1450-line, heavily stateful component
with many closures — real risk of introducing stale-closure bugs without
interactive testing in a browser. Recommend doing this as its own focused
task with manual verification (rapid play/pause/delete while torrents are
actively updating, selection mode toggling mid-update) rather than folding it
into a larger batch.

---

### 6. 5s WebSocket sync polling not gated on tab visibility

**File:** `frontend/src/Torrents.tsx:301-309`

```tsx
useEffect(() => {
  if (isRefreshPaused || !initialLoadComplete) return;

  const intervalId = setInterval(() => {
    requestSync();
  }, refreshIntervalSec * 1000);

  return () => clearInterval(intervalId);
}, [refreshIntervalSec, isRefreshPaused, initialLoadComplete, requestSync]);
```

`isRefreshPaused` is a manual, opt-in toggle — it's not tied to
`document.visibilityState`. A backgrounded/inactive browser tab keeps
requesting full syncs against the qBittorrent-proxied backend every
`refreshIntervalSec` (default 5s) indefinitely.

**Fix:**
```tsx
useEffect(() => {
  if (isRefreshPaused || !initialLoadComplete) return;

  const tick = () => {
    if (document.visibilityState !== 'visible') return;
    requestSync();
  };

  const intervalId = setInterval(tick, refreshIntervalSec * 1000);

  const handleVisibility = () => {
    if (document.visibilityState === 'visible') requestSync();
  };
  document.addEventListener('visibilitychange', handleVisibility);

  return () => {
    clearInterval(intervalId);
    document.removeEventListener('visibilitychange', handleVisibility);
  };
}, [refreshIntervalSec, isRefreshPaused, initialLoadComplete, requestSync]);
```
Skip the tick while hidden, and force one immediate sync on return to
foreground so the view isn't stale after the tab regains focus.

---

### 7. `HealthCheck.tsx` polls every 30s regardless of tab visibility

**File:** `frontend/src/components/HealthCheck.tsx:17-43`

Same pattern as #6, smaller blast radius (single lightweight `/health` call),
but if `HealthCheck` is mounted in a persistent layout region (footer/status
bar visible on every page — confirm in `AppLayout.tsx`), it's a small
constant background load that never pauses when backgrounded.

**Fix:** same visibility-gating pattern as #6, applied to the
`setInterval(checkHealth, 30000)` at line 40.

---

### 8. Filter-option `useMemo`s recompute over the full unfiltered torrent array on every update

**File:** `frontend/src/Torrents.tsx:211-246` (`availableStatuses`,
`availableCategories`, `availableTags`, `availableGrades`)

Each of these four builds a fresh `Set` + `Array.from` + sort over the
*entire* `torrents` array, and all four re-run on every `torrents` state
change (i.e. every WS-driven update), not just when the set of distinct
statuses/categories/tags/grades actually changes. Fine at hundreds of
torrents; will show up in profiling with thousands of torrents across
multiple workers, since it's 4x O(n) work per incremental update.

**Fix (low priority, scale-dependent):** no clean structural fix without
deeper bookkeeping (e.g. maintaining running counts as torrents are
added/removed instead of recomputing from scratch). Only worth doing if a
user reports lag with large libraries — not an issue at current typical
scale.

---

### 9. No virtualization for the torrent list/table

**File:** `frontend/src/Torrents.tsx:161, 694-750` (`LazyLoadingSentinel`,
`displayedItemsCount`) and `components/torrents/TorrentsTable.tsx`,
`TorrentListCompact.tsx`, `TorrentListMobile.tsx`

The existing "load more on scroll" (`displayedItemsCount` grows by 30 at a
time) caps *initial* render cost but every row loaded this way stays
mounted — there's no windowing (e.g. `@tanstack/react-virtual` /
`react-window`). Once a user scrolls through a large filtered set, all of
those rows remain live DOM nodes and re-render candidates.

**Fix (moderate effort, scale-dependent):** introduce `@tanstack/react-virtual`
for the table/list/card views once torrent counts are large enough to matter
(hundreds to thousands of visible rows). Not worth the added complexity at
typical library sizes (tens to low hundreds of torrents per worker).

---

### 10. No request de-duplication for out-of-order responses

**Files:** `frontend/src/History.tsx`, `frontend/src/components/WorkerLogsTab.tsx`

`api.ts` now supports an optional `AbortSignal` per request (see done-items),
but no caller passes one yet. `History.tsx`'s debounced search still doesn't
cancel a superseded in-flight `/events` request when `page`/`filterType`
change again before the first response lands — the last *arriving* response
wins, not necessarily the last *requested* one. Same risk in
`WorkerLogsTab.tsx` when switching workers quickly.

**Fix:** in each affected `useEffect`, create an `AbortController`, pass
`signal: controller.signal` to `api.get(...)`, and call `controller.abort()`
in the effect's cleanup function so a stale request is cancelled the moment
its inputs change or the component unmounts.

```tsx
useEffect(() => {
  const controller = new AbortController();
  loadEvents(controller.signal);
  return () => controller.abort();
}, [page, limit, filterType, debouncedSearchQuery]);
```
(`loadEvents` would need to accept and forward the signal to `api.get`.)

---

## Suggested order

1. Backend #1 (double fetch) — quick, no risk.
2. Backend #2 (WAL mode) — quick, no risk, real concurrency win under the
   now-batched write load.
3. Frontend #6 + #7 (visibility gating) — quick, no risk, same pattern twice.
4. Frontend #10 (AbortSignal wiring in History/WorkerLogsTab) — moderate,
   contained to two files, closes out work already started in `api.ts`.
5. Backend #3, #4 and frontend #8, #9 — defer until there's a concrete signal
   (user-reported lag, larger deployments) that they're worth the effort.
6. Frontend #5 (handler stabilization in `Torrents.tsx`) — do last, as its
   own focused task with manual browser verification; highest risk-to-reward
   ratio of everything on this list given the file's size and the amount of
   state involved.
