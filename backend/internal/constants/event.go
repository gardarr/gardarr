package constants

// Event types
const (
	EventTypeTorrentStateChange       = "torrent.state_change"
	EventTypeTorrentAdded             = "torrent.added"
	EventTypeTorrentRemoved           = "torrent.removed"
	EventTypeTorrentCompleted         = "torrent.completed"
	EventTypeBandwidthScheduleApplied = "bandwidth.schedule_applied"
	EventTypeWorkerOffline            = "worker.offline"
	EventTypeWorkerRecovered          = "worker.recovered"
)

// WorkerEventTypes are the event types surfaced in the "worker" events group
// (History page worker table, ?group=worker). Kept as its own list rather
// than inferring "not a torrent event" so a future non-torrent, non-worker
// event type doesn't silently land in the wrong group.
var WorkerEventTypes = []string{EventTypeWorkerOffline, EventTypeWorkerRecovered}

// ScheduleEventTypes are the event types surfaced in the "schedule" events
// group (History page schedule table, ?group=schedule).
var ScheduleEventTypes = []string{EventTypeBandwidthScheduleApplied}

// TorrentEventTypes are the event types surfaced in the "torrent" events
// group (History page torrent table, ?group=torrent).
var TorrentEventTypes = []string{
	EventTypeTorrentStateChange,
	EventTypeTorrentAdded,
	EventTypeTorrentRemoved,
	EventTypeTorrentCompleted,
}
