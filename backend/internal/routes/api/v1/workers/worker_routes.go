package workers

import (
	stdErrors "errors"
	"io"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jfxdev/gardarr/internal/entities"
	"github.com/jfxdev/gardarr/internal/mappers"
	"github.com/jfxdev/gardarr/internal/models"
	"github.com/jfxdev/gardarr/internal/schemas"
	"github.com/jfxdev/gardarr/internal/services/bandwidthscheduler"
	"github.com/jfxdev/gardarr/internal/services/workermanager"
	"github.com/jfxdev/gardarr/pkg/errors"
)

// Module holds worker routes configuration
type Module struct {
	service            *workermanager.Service
	bandwidthScheduler *bandwidthscheduler.Service
	workersRouter      *gin.RouterGroup
	workerRouter       *gin.RouterGroup
}

func NewModule(router *gin.RouterGroup, svc *workermanager.Service, bandwidthScheduler *bandwidthscheduler.Service) *Module {
	return &Module{
		service:            svc,
		bandwidthScheduler: bandwidthScheduler,
		workersRouter:      router.Group("/workers"),
		workerRouter:       router.Group("/worker"),
	}
}

func (m Module) Register() {
	m.workersRouter.GET("/", m.listWorkers)
	m.workersRouter.POST("/tasks/bulk", m.bulkWorkerTaskAction)

	m.workerRouter.POST("/", m.createWorker)
	m.workerRouter.GET("/:id", m.getWorker)
	m.workerRouter.PUT("/:id", m.updateWorker)

	m.workerRouter.POST("/:id/speed/limits", m.setWorkerSpeedLimits)
	m.workerRouter.GET("/:id/schedules", m.listSchedules)
	m.workerRouter.POST("/:id/schedules", m.createSchedule)
	m.workerRouter.GET("/:id/schedules/preview", m.previewSchedule)
	m.workerRouter.PUT("/:id/schedules/order", m.reorderSchedules)
	m.workerRouter.GET("/:id/schedules/:schedule_id", m.getSchedule)
	m.workerRouter.PUT("/:id/schedules/:schedule_id", m.updateSchedule)
	m.workerRouter.DELETE("/:id/schedules/:schedule_id", m.deleteSchedule)
	m.workerRouter.POST("/:id/active/limits", m.setWorkerMaxActiveTorrents)

	m.workerRouter.GET("/:id/version", m.getWorkerVersion)
	m.workerRouter.GET("/:id/preferences", m.getWorkerPreferences)
	m.workerRouter.GET("/:id/logs", m.getWorkerLogs)
	m.workerRouter.DELETE("/:id", m.deleteWorker)
	m.workerRouter.POST("/:id/task", m.createWorkerTask)
	m.workerRouter.POST("/:id/task/file", m.createWorkerTaskFromFile)
	m.workerRouter.GET("/:id/task/:task_id", m.getWorkerTask)
	m.workerRouter.DELETE("/:id/task/:task_id", m.deleteWorkerTask)
	m.workerRouter.POST("/:id/task/:task_id/stop", m.stopWorkerTask)
	m.workerRouter.POST("/:id/task/:task_id/start", m.startWorkerTask)
	m.workerRouter.POST("/:id/task/:task_id/force_download", m.forceDownloadWorkerTask)
	m.workerRouter.POST("/:id/task/:task_id/force_resume", m.forceResumeWorkerTask)
	m.workerRouter.PUT("/:id/task/:task_id/share_limit", m.setWorkerTaskShareLimit)
	m.workerRouter.POST("/:id/task/:task_id/location", m.setWorkerTaskLocation)
	m.workerRouter.POST("/:id/task/:task_id/rename", m.renameWorkerTask)
	m.workerRouter.GET("/:id/task/:task_id/limits", m.getWorkerTaskLimits)
	m.workerRouter.POST("/:id/task/:task_id/super_seeding", m.setWorkerTaskSuperSeeding)
	m.workerRouter.POST("/:id/task/:task_id/force_recheck", m.forceRecheckWorkerTask)
	m.workerRouter.POST("/:id/task/:task_id/force_reannounce", m.forceReannounceWorkerTask)
	m.workerRouter.POST("/:id/task/:task_id/limit_download_rate", m.setWorkerTaskDownloadLimit)
	m.workerRouter.POST("/:id/task/:task_id/limit_upload_rate", m.setWorkerTaskUploadLimit)
	m.workerRouter.PUT("/:id/task/:task_id/tags", m.setWorkerTaskTags)
	m.workerRouter.PUT("/:id/task/:task_id/category", m.setWorkerTaskCategory)
	m.workerRouter.GET("/:id/task/:task_id/files", m.listWorkerTaskFiles)
}

func (m *Module) createWorker(c *gin.Context) {
	var body schemas.WorkerCreateSchema
	if err := c.ShouldBindJSON(&body); err != nil {
		respErr := errors.NewBadRequestError("Invalid request body", err)
		c.JSON(respErr.StatusCode, respErr)
		return
	}

	result, err := m.service.CreateWorker(c.Request.Context(), &body)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, mappers.ToWorkerResponse(result))
}

func (m *Module) listWorkers(c *gin.Context) {
	// live=false skips the per-worker qBittorrent connectivity/instance
	// check and returns DB rows only (fast path for the /workers page's
	// initial render). Defaults to true so every existing caller keeps
	// getting real status unless it explicitly opts out.
	live := c.DefaultQuery("live", "true") != "false"

	var result []*entities.Worker
	var err error
	if live {
		result, err = m.service.ListWorkers()
	} else {
		result, err = m.service.ListWorkersBasic()
	}
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	resp := make([]*models.WorkerResponse, len(result))
	ids := make([]uuid.UUID, 0, len(result))
	for _, item := range result {
		ids = append(ids, item.UUID)
	}
	statuses := map[uuid.UUID]bandwidthscheduler.Status{}
	if m.bandwidthScheduler != nil {
		if resolved, statusErr := m.bandwidthScheduler.Statuses(c.Request.Context(), ids); statusErr == nil {
			statuses = resolved
		}
	}
	for i, item := range result {
		resp[i] = mappers.ToWorkerResponse(item)
		if status, ok := statuses[item.UUID]; ok && status.Active && status.Schedule != nil && status.Limits != nil {
			d, u := status.Limits.DownloadLimit, status.Limits.UploadLimit
			resp[i].BandwidthScheduleStatus = &models.BandwidthScheduleStatusResponse{Active: true, Name: status.Schedule.Name, DownloadLimit: &d, UploadLimit: &u}
		}
	}

	c.JSON(http.StatusOK, resp)
}

func (m *Module) getWorker(c *gin.Context) {
	id := c.Param("id")

	result, err := m.service.GetWorker(c.Request.Context(), id)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, mappers.ToWorkerResponse(result))
}

func (m *Module) getWorkerPreferences(c *gin.Context) {
	id := c.Param("id")

	// First get the worker to ensure it exists
	worker, err := m.service.GetWorker(c.Request.Context(), id)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	// Then get the worker preferences
	preferences, err := m.service.GetPreferences(c.Request.Context(), worker)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, mappers.ToInstancePreferencesResponse(preferences))
}

func (m *Module) updateWorker(c *gin.Context) {
	id := c.Param("id")

	var body schemas.WorkerUpdateSchema
	if err := c.ShouldBindJSON(&body); err != nil {
		respErr := errors.NewBadRequestError("Invalid request body", err)
		c.JSON(respErr.StatusCode, respErr)
		return
	}

	result, err := m.service.UpdateWorker(c.Request.Context(), id, &body)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, mappers.ToWorkerResponse(result))
}

func (m *Module) deleteWorker(c *gin.Context) {
	id := c.Param("id")

	if err := m.service.DeleteWorker(c.Request.Context(), id); err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

// bulkWorkerTaskAction applies one action to many tasks, possibly spanning
// multiple workers. Returns 200 with per-worker partial failures in the body.
func (m *Module) bulkWorkerTaskAction(c *gin.Context) {
	var body schemas.BulkTaskActionSchema
	if err := c.ShouldBindJSON(&body); err != nil {
		respErr := errors.NewBadRequestError("Invalid request body", err)
		c.JSON(respErr.StatusCode, respErr)
		return
	}

	result, err := m.service.BulkTaskAction(c.Request.Context(), body)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, result)
}

func (m *Module) createWorkerTask(c *gin.Context) {
	id := c.Param("id")

	var body schemas.TaskCreateSchema
	if err := c.ShouldBindJSON(&body); err != nil {
		respErr := errors.NewBadRequestError("Invalid request body", err)
		c.JSON(respErr.StatusCode, respErr)
		return
	}

	result, err := m.service.CreateWorkerTask(c.Request.Context(), id, body)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, mappers.ToTaskResponse(result))
}

// maxTorrentFileSize bounds uploaded .torrent files (metadata only; real
// torrents rarely exceed a few hundred KB).
const maxTorrentFileSize = 5 << 20 // 5MB

// createWorkerTaskFromFile adds a torrent from an uploaded .torrent file
// (multipart form: "torrent" file part + category/directory/tags fields).
func (m *Module) createWorkerTaskFromFile(c *gin.Context) {
	id := c.Param("id")

	var body schemas.TaskCreateFromFileSchema
	if err := c.ShouldBind(&body); err != nil {
		respErr := errors.NewBadRequestError("Invalid request body", err)
		c.JSON(respErr.StatusCode, respErr)
		return
	}

	fileHeader, err := c.FormFile("torrent")
	if err != nil {
		respErr := errors.NewBadRequestError("Missing torrent file", err)
		c.JSON(respErr.StatusCode, respErr)
		return
	}

	if fileHeader.Size > maxTorrentFileSize {
		respErr := errors.NewBadRequestError("Torrent file too large (max 5MB)", nil)
		c.JSON(respErr.StatusCode, respErr)
		return
	}

	if !strings.EqualFold(filepath.Ext(fileHeader.Filename), ".torrent") {
		respErr := errors.NewBadRequestError("File must have .torrent extension", nil)
		c.JSON(respErr.StatusCode, respErr)
		return
	}

	file, err := fileHeader.Open()
	if err != nil {
		respErr := errors.NewBadRequestError("Failed to read torrent file", err)
		c.JSON(respErr.StatusCode, respErr)
		return
	}
	defer file.Close()

	fileData, err := io.ReadAll(io.LimitReader(file, maxTorrentFileSize+1))
	if err != nil {
		respErr := errors.NewBadRequestError("Failed to read torrent file", err)
		c.JSON(respErr.StatusCode, respErr)
		return
	}
	if len(fileData) > maxTorrentFileSize {
		respErr := errors.NewBadRequestError("Torrent file too large (max 5MB)", nil)
		c.JSON(respErr.StatusCode, respErr)
		return
	}

	result, err := m.service.CreateWorkerTaskFromFile(c.Request.Context(), id, fileHeader.Filename, fileData, body)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, mappers.ToTaskResponse(result))
}

func (m *Module) stopWorkerTask(c *gin.Context) {
	workerID := c.Param("id")
	taskID := c.Param("task_id")

	if err := m.service.StopWorkerTask(c.Request.Context(), workerID, taskID); err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Task stopped successfully"})
}

func (m *Module) startWorkerTask(c *gin.Context) {
	workerID := c.Param("id")
	taskID := c.Param("task_id")

	if err := m.service.StartWorkerTask(c.Request.Context(), workerID, taskID); err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Task started successfully"})
}

func (m *Module) forceDownloadWorkerTask(c *gin.Context) {
	workerID := c.Param("id")
	taskID := c.Param("task_id")

	if err := m.service.ForceDownloadWorkerTask(c.Request.Context(), workerID, taskID); err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Task force download initiated successfully"})
}

func (m *Module) getWorkerTask(c *gin.Context) {
	workerID := c.Param("id")
	taskID := c.Param("task_id")

	result, err := m.service.GetWorkerTask(c.Request.Context(), workerID, taskID)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, mappers.ToTaskResponse(result))
}

func (m *Module) deleteWorkerTask(c *gin.Context) {
	workerID := c.Param("id")
	taskID := c.Param("task_id")

	// Get purge parameter from query string
	purge := c.DefaultQuery("purge", "false") == "true"

	if err := m.service.DeleteWorkerTask(c.Request.Context(), workerID, taskID, purge); err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

func (m *Module) forceResumeWorkerTask(c *gin.Context) {
	workerID := c.Param("id")
	taskID := c.Param("task_id")

	if err := m.service.ForceResumeWorkerTask(c.Request.Context(), workerID, taskID); err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Task force resumed successfully"})
}

func (m *Module) setWorkerTaskShareLimit(c *gin.Context) {
	workerID := c.Param("id")
	taskID := c.Param("task_id")

	var body schemas.TaskSetShareLimitSchema
	if err := c.ShouldBindJSON(&body); err != nil {
		respErr := errors.NewBadRequestError("Invalid request body", err)
		c.JSON(respErr.StatusCode, respErr)
		return
	}

	if err := m.service.SetWorkerTaskShareLimit(c.Request.Context(), workerID, taskID, body); err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Task share limit set successfully"})
}

func (m *Module) setWorkerTaskLocation(c *gin.Context) {
	workerID := c.Param("id")
	taskID := c.Param("task_id")

	var body schemas.TaskSetLocationSchema
	if err := c.ShouldBindJSON(&body); err != nil {
		respErr := errors.NewBadRequestError("Invalid request body", err)
		c.JSON(respErr.StatusCode, respErr)
		return
	}

	if err := m.service.SetWorkerTaskLocation(c.Request.Context(), workerID, taskID, body); err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Task location set successfully"})
}

func (m *Module) renameWorkerTask(c *gin.Context) {
	workerID := c.Param("id")
	taskID := c.Param("task_id")

	var body schemas.TaskRenameSchema
	if err := c.ShouldBindJSON(&body); err != nil {
		respErr := errors.NewBadRequestError("Invalid request body", err)
		c.JSON(respErr.StatusCode, respErr)
		return
	}

	if err := m.service.RenameWorkerTask(c.Request.Context(), workerID, taskID, body); err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Task renamed successfully"})
}

func (m *Module) setWorkerTaskSuperSeeding(c *gin.Context) {
	workerID := c.Param("id")
	taskID := c.Param("task_id")

	var body schemas.TaskSuperSeedingSchema
	if err := c.ShouldBindJSON(&body); err != nil {
		respErr := errors.NewBadRequestError("Invalid request body", err)
		c.JSON(respErr.StatusCode, respErr)
		return
	}

	if err := m.service.SetWorkerTaskSuperSeeding(c.Request.Context(), workerID, taskID, body); err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Task super seeding mode set successfully"})
}

func (m *Module) forceRecheckWorkerTask(c *gin.Context) {
	workerID := c.Param("id")
	taskID := c.Param("task_id")

	if err := m.service.ForceRecheckWorkerTask(c.Request.Context(), workerID, taskID); err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Task force recheck initiated successfully"})
}

func (m *Module) forceReannounceWorkerTask(c *gin.Context) {
	workerID := c.Param("id")
	taskID := c.Param("task_id")

	if err := m.service.ForceReannounceWorkerTask(c.Request.Context(), workerID, taskID); err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Task force reannounce initiated successfully"})
}

func (m *Module) setWorkerTaskDownloadLimit(c *gin.Context) {
	workerID := c.Param("id")
	taskID := c.Param("task_id")

	var body schemas.TaskSetDownloadLimitSchema
	if err := c.ShouldBindJSON(&body); err != nil {
		respErr := errors.NewBadRequestError("Invalid request body", err)
		c.JSON(respErr.StatusCode, respErr)
		return
	}

	if err := m.service.SetWorkerTaskDownloadLimit(c.Request.Context(), workerID, taskID, body); err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Task download limit set successfully"})
}

func (m *Module) setWorkerTaskUploadLimit(c *gin.Context) {
	workerID := c.Param("id")
	taskID := c.Param("task_id")

	var body schemas.TaskSetUploadLimitSchema
	if err := c.ShouldBindJSON(&body); err != nil {
		respErr := errors.NewBadRequestError("Invalid request body", err)
		c.JSON(respErr.StatusCode, respErr)
		return
	}

	if err := m.service.SetWorkerTaskUploadLimit(c.Request.Context(), workerID, taskID, body); err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Task upload limit set successfully"})
}

func (m *Module) listWorkerTaskFiles(c *gin.Context) {
	workerID := c.Param("id")
	taskID := c.Param("task_id")

	files, err := m.service.ListWorkerTaskFiles(c.Request.Context(), workerID, taskID)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, mappers.ToTaskFilesResponse(files))
}

func (m *Module) setWorkerTaskTags(c *gin.Context) {
	workerID := c.Param("id")
	taskID := c.Param("task_id")

	var body schemas.TaskSetTagsSchema
	if err := c.ShouldBindJSON(&body); err != nil {
		respErr := errors.NewBadRequestError("Invalid request body", err)
		c.JSON(respErr.StatusCode, respErr)
		return
	}

	if err := m.service.SetWorkerTaskTags(c.Request.Context(), workerID, taskID, body); err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Task tags updated successfully"})
}

func (m *Module) setWorkerTaskCategory(c *gin.Context) {
	workerID := c.Param("id")
	taskID := c.Param("task_id")

	var body schemas.TaskSetCategorySchema
	if err := c.ShouldBindJSON(&body); err != nil {
		respErr := errors.NewBadRequestError("Invalid request body", err)
		c.JSON(respErr.StatusCode, respErr)
		return
	}

	if err := m.service.SetWorkerTaskCategory(c.Request.Context(), workerID, taskID, body); err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Task category updated successfully"})
}

func (m *Module) getWorkerVersion(c *gin.Context) {
	workerID := c.Param("id")

	version, err := m.service.GetWorkerVersion(c.Request.Context(), workerID)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, mappers.ToWorkerVersionResponse(version))
}

func (m *Module) getWorkerTaskLimits(c *gin.Context) {
	workerID := c.Param("id")
	taskID := c.Param("task_id")

	worker, err := m.service.GetWorker(c.Request.Context(), workerID)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	limits, err := m.service.GetWorkerTaskLimits(c.Request.Context(), worker, taskID)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, mappers.ToTaskLimitsResponse(limits))
}

func (m *Module) setWorkerMaxActiveTorrents(c *gin.Context) {
	var body schemas.InstanceSetMaxActiveTorrentLimitsSchema
	if err := c.ShouldBindJSON(&body); err != nil {
		respErr := errors.NewBadRequestError("Invalid request body", err)
		c.JSON(respErr.StatusCode, respErr)
		return
	}

	workerID := c.Param("id")
	worker, err := m.service.GetWorker(c.Request.Context(), workerID)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	if err := m.service.SetWorkerGlobalActiveLimits(c.Request.Context(), worker, body); err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Instance max active torrents set successfully"})
}

func (m *Module) setWorkerSpeedLimits(c *gin.Context) {
	var body schemas.InstanceSetSpeedLimitSchema
	if err := c.ShouldBindJSON(&body); err != nil {
		respErr := errors.NewBadRequestError("Invalid request body", err)
		c.JSON(respErr.StatusCode, respErr)
		return
	}

	workerID := c.Param("id")
	worker, err := m.service.GetWorker(c.Request.Context(), workerID)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	if m.bandwidthScheduler != nil {
		err = m.bandwidthScheduler.ApplyManualDefault(c.Request.Context(), worker, bandwidthscheduler.Limits{DownloadLimit: *body.DownloadLimit, UploadLimit: *body.UploadLimit})
	} else {
		err = m.service.SetWorkerGlobalSpeedLimits(c.Request.Context(), worker, body)
	}
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Instance speed limits set successfully"})
}

func (m *Module) listSchedules(c *gin.Context) {
	worker, err := m.service.GetWorker(c.Request.Context(), c.Param("id"))
	if err != nil {
		errors.HandleError(c, err)
		return
	}
	items, err := m.bandwidthScheduler.List(c.Request.Context(), worker.UUID)
	if err != nil {
		errors.HandleError(c, err)
		return
	}
	c.JSON(http.StatusOK, items)
}

func (m *Module) createSchedule(c *gin.Context) {
	var input bandwidthscheduler.Input
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}
	worker, err := m.service.GetWorker(c.Request.Context(), c.Param("id"))
	if err != nil {
		errors.HandleError(c, err)
		return
	}
	item, err := m.bandwidthScheduler.Create(c.Request.Context(), worker, input)
	if err != nil {
		m.handleScheduleError(c, err)
		return
	}
	c.JSON(http.StatusCreated, item)
}

func (m *Module) getSchedule(c *gin.Context) {
	worker, err := m.service.GetWorker(c.Request.Context(), c.Param("id"))
	if err != nil {
		errors.HandleError(c, err)
		return
	}
	id, err := uuid.Parse(c.Param("schedule_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid schedule ID"})
		return
	}
	item, err := m.bandwidthScheduler.Get(c.Request.Context(), worker.UUID, id)
	if err != nil {
		m.handleScheduleError(c, err)
		return
	}
	c.JSON(http.StatusOK, item)
}

func (m *Module) updateSchedule(c *gin.Context) {
	var input bandwidthscheduler.Input
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}
	worker, err := m.service.GetWorker(c.Request.Context(), c.Param("id"))
	if err != nil {
		errors.HandleError(c, err)
		return
	}
	id, err := uuid.Parse(c.Param("schedule_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid schedule ID"})
		return
	}
	item, err := m.bandwidthScheduler.Update(c.Request.Context(), worker, id, input)
	if err != nil {
		m.handleScheduleError(c, err)
		return
	}
	c.JSON(http.StatusOK, item)
}

func (m *Module) deleteSchedule(c *gin.Context) {
	worker, err := m.service.GetWorker(c.Request.Context(), c.Param("id"))
	if err != nil {
		errors.HandleError(c, err)
		return
	}
	id, err := uuid.Parse(c.Param("schedule_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid schedule ID"})
		return
	}
	if err := m.bandwidthScheduler.Delete(c.Request.Context(), worker, id); err != nil {
		m.handleScheduleError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (m *Module) reorderSchedules(c *gin.Context) {
	var input bandwidthscheduler.OrderInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}
	worker, err := m.service.GetWorker(c.Request.Context(), c.Param("id"))
	if err != nil {
		errors.HandleError(c, err)
		return
	}
	items, err := m.bandwidthScheduler.Reorder(c.Request.Context(), worker, input)
	if err != nil {
		m.handleScheduleError(c, err)
		return
	}
	c.JSON(http.StatusOK, items)
}

func (m *Module) previewSchedule(c *gin.Context) {
	worker, err := m.service.GetWorker(c.Request.Context(), c.Param("id"))
	if err != nil {
		errors.HandleError(c, err)
		return
	}
	preview, err := m.bandwidthScheduler.Preview(c.Request.Context(), worker.UUID)
	if err != nil {
		errors.HandleError(c, err)
		return
	}
	c.JSON(http.StatusOK, preview)
}

func (m *Module) handleScheduleError(c *gin.Context, err error) {
	switch {
	case stdErrors.Is(err, bandwidthscheduler.ErrScheduleNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
	case stdErrors.Is(err, bandwidthscheduler.ErrPriorityConflict):
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
	case stdErrors.Is(err, bandwidthscheduler.ErrScheduleLimit):
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
	case stdErrors.Is(err, bandwidthscheduler.ErrInvalidScheduleOrder):
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
	default:
		errors.HandleError(c, err)
	}
}

func (m *Module) getWorkerLogs(c *gin.Context) {
	workerID := c.Param("id")

	normal := c.Query("normal") == "true"
	info := c.Query("info") == "true"
	warning := c.Query("warning") == "true"
	critical := c.Query("critical") == "true"

	lastKnownID := 0
	if idStr := c.Query("last_known_id"); idStr != "" {
		if id, err := strconv.Atoi(idStr); err == nil {
			lastKnownID = id
		}
	}

	result, err := m.service.GetWorkerLogs(c.Request.Context(), workerID, normal, info, warning, critical, lastKnownID)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, result)
}
