package metrics

import (
	"context"
	"time"

	"github.com/jfxdev/gardarr/internal/entities"
	"github.com/jfxdev/gardarr/internal/services/workermanager"
	"github.com/jfxdev/gardarr/pkg/logger"
	"github.com/prometheus/client_golang/prometheus"
)

const namespace = "gardarr"

// Exporter implements prometheus.Collector and collects metrics on each scrape.
type Exporter struct {
	workers *workermanager.Service

	// Task metrics
	taskDownloadSpeed   *prometheus.Desc
	taskUploadSpeed     *prometheus.Desc
	taskDownloadedTotal *prometheus.Desc
	taskUploadedTotal   *prometheus.Desc
	taskProgress        *prometheus.Desc
	taskRatio           *prometheus.Desc
	taskSeeders         *prometheus.Desc
	taskLeechers        *prometheus.Desc
	taskSizeBytes       *prometheus.Desc
	taskState           *prometheus.Desc

	// Worker metrics
	workerStatus          *prometheus.Desc
	workerFreeDiskBytes   *prometheus.Desc
	workerGlobalRatio     *prometheus.Desc
	workerVersionInfo     *prometheus.Desc
	workerDownloadedTotal *prometheus.Desc
	workerUploadedTotal   *prometheus.Desc

	// Server metrics
	workersTotal *prometheus.Desc
}

// NewExporter creates and returns a new Exporter.
func NewExporter(workers *workermanager.Service) *Exporter {
	taskLabels := []string{"worker_id", "task_id", "task_name"}
	workerLabels := []string{"worker_id", "worker_name"}

	return &Exporter{
		workers: workers,

		// Task
		taskDownloadSpeed:   prometheus.NewDesc(namespace+"_task_download_speed_bytes", "Current download speed in bytes/s", taskLabels, nil),
		taskUploadSpeed:     prometheus.NewDesc(namespace+"_task_upload_speed_bytes", "Current upload speed in bytes/s", taskLabels, nil),
		taskDownloadedTotal: prometheus.NewDesc(namespace+"_task_downloaded_bytes_total", "Total bytes downloaded", taskLabels, nil),
		taskUploadedTotal:   prometheus.NewDesc(namespace+"_task_uploaded_bytes_total", "Total bytes uploaded", taskLabels, nil),
		taskProgress:        prometheus.NewDesc(namespace+"_task_progress_ratio", "Download progress 0.0-1.0", taskLabels, nil),
		taskRatio:           prometheus.NewDesc(namespace+"_task_ratio", "Share ratio", taskLabels, nil),
		taskSeeders:         prometheus.NewDesc(namespace+"_task_seeders", "Connected seeders", taskLabels, nil),
		taskLeechers:        prometheus.NewDesc(namespace+"_task_leechers", "Connected leechers", taskLabels, nil),
		taskSizeBytes:       prometheus.NewDesc(namespace+"_task_size_bytes", "Total task size in bytes", taskLabels, nil),
		taskState:           prometheus.NewDesc(namespace+"_task_state", "Task state (1 for current state)", append(taskLabels, "state"), nil),

		// Worker
		workerStatus:          prometheus.NewDesc(namespace+"_worker_status", "Worker status (1=active, 0=other)", append(workerLabels, "status"), nil),
		workerFreeDiskBytes:   prometheus.NewDesc(namespace+"_worker_free_disk_bytes", "Free disk space in bytes", workerLabels, nil),
		workerGlobalRatio:     prometheus.NewDesc(namespace+"_worker_global_ratio", "qBittorrent global ratio", workerLabels, nil),
		workerVersionInfo:     prometheus.NewDesc(namespace+"_worker_version_info", "qBittorrent version info (always 1)", append(workerLabels, "version"), nil),
		workerDownloadedTotal: prometheus.NewDesc(namespace+"_worker_downloaded_bytes_total", "All-time downloaded bytes", workerLabels, nil),
		workerUploadedTotal:   prometheus.NewDesc(namespace+"_worker_uploaded_bytes_total", "All-time uploaded bytes", workerLabels, nil),

		// Server
		workersTotal: prometheus.NewDesc(namespace+"_workers_total", "Total workers by status", []string{"status"}, nil),
	}
}

// Describe implements prometheus.Collector.
func (e *Exporter) Describe(ch chan<- *prometheus.Desc) {
	ch <- e.taskDownloadSpeed
	ch <- e.taskUploadSpeed
	ch <- e.taskDownloadedTotal
	ch <- e.taskUploadedTotal
	ch <- e.taskProgress
	ch <- e.taskRatio
	ch <- e.taskSeeders
	ch <- e.taskLeechers
	ch <- e.taskSizeBytes
	ch <- e.taskState

	ch <- e.workerStatus
	ch <- e.workerFreeDiskBytes
	ch <- e.workerGlobalRatio
	ch <- e.workerVersionInfo
	ch <- e.workerDownloadedTotal
	ch <- e.workerUploadedTotal

	ch <- e.workersTotal
}

// Collect implements prometheus.Collector. Called on each Prometheus scrape.
func (e *Exporter) Collect(ch chan<- prometheus.Metric) {
	workers, err := e.workers.ListWorkers()
	if err != nil {
		logger.Error("metrics exporter: failed to list workers", "error", err.Error())
		return
	}

	// Server-level: workers count by status
	statusCounts := map[string]int{}
	for _, w := range workers {
		statusCounts[w.Status]++
	}
	for status, count := range statusCounts {
		ch <- prometheus.MustNewConstMetric(e.workersTotal, prometheus.GaugeValue, float64(count), status)
	}

	// Worker and task metrics for active workers
	var activeWorkers []*entities.Worker
	for _, w := range workers {
		if w.Status == entities.WorkerStatusActive {
			activeWorkers = append(activeWorkers, w)
		}
		// Emit worker status for all workers
		statusValue := 0.0
		if w.Status == entities.WorkerStatusActive {
			statusValue = 1.0
		}
		ch <- prometheus.MustNewConstMetric(e.workerStatus, prometheus.GaugeValue, statusValue, w.UUID.String(), w.Name, w.Status)
	}

	// Collect worker instance info and tasks for active workers
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	for _, w := range activeWorkers {
		e.collectWorkerMetrics(ch, w)
		e.collectTaskMetrics(ctx, ch, w)
	}
}

func (e *Exporter) collectWorkerMetrics(ch chan<- prometheus.Metric, w *entities.Worker) {
	workerID := w.UUID.String()
	workerName := w.Name

	if w.Instance == nil {
		return
	}

	inst := w.Instance

	ch <- prometheus.MustNewConstMetric(e.workerFreeDiskBytes, prometheus.GaugeValue, float64(inst.Server.FreeSpaceOnDisk), workerID, workerName)
	ch <- prometheus.MustNewConstMetric(e.workerGlobalRatio, prometheus.GaugeValue, inst.Transfer.GlobalRatio, workerID, workerName)
	ch <- prometheus.MustNewConstMetric(e.workerVersionInfo, prometheus.GaugeValue, 1, workerID, workerName, inst.Application.Version)
	ch <- prometheus.MustNewConstMetric(e.workerDownloadedTotal, prometheus.GaugeValue, float64(inst.Transfer.AllTimeDownloaded), workerID, workerName)
	ch <- prometheus.MustNewConstMetric(e.workerUploadedTotal, prometheus.GaugeValue, float64(inst.Transfer.AllTimeUploaded), workerID, workerName)
}

func (e *Exporter) collectTaskMetrics(ctx context.Context, ch chan<- prometheus.Metric, w *entities.Worker) {
	workerID := w.UUID.String()

	result, err := e.workers.ListTasks(ctx, []*entities.Worker{w})
	if err != nil {
		logger.Debug("metrics exporter: failed to list tasks",
			"worker_id", workerID,
			"error", err.Error(),
		)
		return
	}

	for _, t := range result.Tasks {
		name := t.Name
		if t.Metadata != nil && t.Metadata.Name != "" {
			name = t.Metadata.Name
		}
		labels := []string{workerID, t.Hash, name}

		ch <- prometheus.MustNewConstMetric(e.taskDownloadSpeed, prometheus.GaugeValue, float64(t.Network.Download.Speed), labels...)
		ch <- prometheus.MustNewConstMetric(e.taskUploadSpeed, prometheus.GaugeValue, float64(t.Network.Upload.Speed), labels...)
		ch <- prometheus.MustNewConstMetric(e.taskDownloadedTotal, prometheus.GaugeValue, float64(t.Network.Download.Amount), labels...)
		ch <- prometheus.MustNewConstMetric(e.taskUploadedTotal, prometheus.GaugeValue, float64(t.Network.Upload.Amount), labels...)
		ch <- prometheus.MustNewConstMetric(e.taskProgress, prometheus.GaugeValue, t.Progress, labels...)
		ch <- prometheus.MustNewConstMetric(e.taskRatio, prometheus.GaugeValue, t.Ratio, labels...)
		ch <- prometheus.MustNewConstMetric(e.taskSeeders, prometheus.GaugeValue, float64(t.Pairs.Seeders), labels...)
		ch <- prometheus.MustNewConstMetric(e.taskLeechers, prometheus.GaugeValue, float64(t.Pairs.Leechers), labels...)
		ch <- prometheus.MustNewConstMetric(e.taskSizeBytes, prometheus.GaugeValue, float64(t.Size), labels...)
		ch <- prometheus.MustNewConstMetric(e.taskState, prometheus.GaugeValue, 1, append(labels, t.State)...)
	}
}
