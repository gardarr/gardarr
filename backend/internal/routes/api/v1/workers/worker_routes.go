package workers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/jfxdev/gardarr/internal/mappers"
	"github.com/jfxdev/gardarr/internal/models"
	"github.com/jfxdev/gardarr/internal/schemas"
	"github.com/jfxdev/gardarr/internal/services/workermanager"
	"github.com/jfxdev/gardarr/pkg/errors"
)

// Module holds worker routes configuration
type Module struct {
	service       *workermanager.Service
	workersRouter *gin.RouterGroup
	workerRouter  *gin.RouterGroup
}

func NewModule(router *gin.RouterGroup, svc *workermanager.Service) *Module {
	return &Module{
		service:       svc,
		workersRouter: router.Group("/workers"),
		workerRouter:  router.Group("/worker"),
	}
}

func (m Module) Register() {
	m.workersRouter.GET("/", m.listWorkers)

	m.workerRouter.POST("/", m.createWorker)
	m.workerRouter.GET("/:id", m.getWorker)
	m.workerRouter.PUT("/:id", m.updateWorker)

	m.workerRouter.POST("/:id/speed/limits", m.setWorkerSpeedLimits)
	m.workerRouter.POST("/:id/active/limits", m.setWorkerMaxActiveTorrents)

	m.workerRouter.GET("/:id/version", m.getWorkerVersion)
	m.workerRouter.GET("/:id/preferences", m.getWorkerPreferences)
	m.workerRouter.GET("/:id/logs", m.getWorkerLogs)
	m.workerRouter.DELETE("/:id", m.deleteWorker)
	m.workerRouter.POST("/:id/task", m.createWorkerTask)
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
	result, err := m.service.ListWorkers()
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	resp := make([]*models.WorkerResponse, len(result))
	for i, item := range result {
		resp[i] = mappers.ToWorkerResponse(item)
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

	if err := m.service.SetWorkerGlobalSpeedLimits(c.Request.Context(), worker, body); err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Instance speed limits set successfully"})
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
