package agents

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jfxdev/gardarr/internal/mappers"
	"github.com/jfxdev/gardarr/internal/models"
	"github.com/jfxdev/gardarr/internal/schemas"
	"github.com/jfxdev/gardarr/internal/services/agentmanager"
	"github.com/jfxdev/gardarr/pkg/errors"
	"github.com/jfxdev/gardarr/pkg/version"
)

// Module holds agent routes configuration
type Module struct {
	service      *agentmanager.Service
	agentsRouter *gin.RouterGroup
	agentRouter  *gin.RouterGroup
}

func NewModule(router *gin.RouterGroup, svc *agentmanager.Service) *Module {
	return &Module{
		service:      svc,
		agentsRouter: router.Group("/agents"),
		agentRouter:  router.Group("/agent"),
	}
}

func (m Module) Register() {
	m.agentsRouter.GET("/", m.listAgents)
	m.agentsRouter.GET("/tasks", m.listAgentsTasks)

	m.agentRouter.POST("/", m.createAgent)
	m.agentRouter.GET("/:id", m.getAgent)
	m.agentRouter.PUT("/:id", m.updateAgent)
	m.agentRouter.GET("/:id/version", m.getAgentVersion)
	m.agentRouter.GET("/:id/tasks", m.listAgentTasks)
	m.agentRouter.GET("/:id/tasks/stats", m.getAgentTasksStats)
	m.agentRouter.GET("/:id/preferences", m.getAgentPreferences)
	m.agentRouter.DELETE("/:id", m.deleteAgent)
	m.agentRouter.POST("/:id/task", m.createAgentTask)
	m.agentRouter.GET("/:id/task/:task_id", m.getAgentTask)
	m.agentRouter.DELETE("/:id/task/:task_id", m.deleteAgentTask)
	m.agentRouter.POST("/:id/task/:task_id/stop", m.stopAgentTask)
	m.agentRouter.POST("/:id/task/:task_id/start", m.startAgentTask)
	m.agentRouter.POST("/:id/task/:task_id/force_download", m.forceDownloadAgentTask)
	m.agentRouter.POST("/:id/task/:task_id/force_resume", m.forceResumeAgentTask)
	m.agentRouter.PUT("/:id/task/:task_id/share_limit", m.setAgentTaskShareLimit)
	m.agentRouter.POST("/:id/task/:task_id/location", m.setAgentTaskLocation)
	m.agentRouter.POST("/:id/task/:task_id/rename", m.renameAgentTask)
	m.agentRouter.GET("/:id/task/:task_id/limits", m.getAgentTaskLimits)
	m.agentRouter.POST("/:id/task/:task_id/super_seeding", m.setAgentTaskSuperSeeding)
	m.agentRouter.POST("/:id/task/:task_id/force_recheck", m.forceRecheckAgentTask)
	m.agentRouter.POST("/:id/task/:task_id/force_reannounce", m.forceReannounceAgentTask)
	m.agentRouter.POST("/:id/task/:task_id/limit_download_rate", m.setAgentTaskDownloadLimit)
	m.agentRouter.POST("/:id/task/:task_id/limit_upload_rate", m.setAgentTaskUploadLimit)
	m.agentRouter.PUT("/:id/task/:task_id/tags", m.setAgentTaskTags)
	m.agentRouter.PUT("/:id/task/:task_id/category", m.setAgentTaskCategory)
	m.agentRouter.GET("/:id/task/:task_id/files", m.listAgentTaskFiles)
}

func (m *Module) createAgent(c *gin.Context) {
	var body schemas.AgentCreateSchema
	if err := c.ShouldBindJSON(&body); err != nil {
		respErr := errors.NewBadRequestError("Invalid request body", err)
		c.JSON(respErr.StatusCode, respErr)
		return
	}

	result, err := m.service.CreateAgent(c.Request.Context(), &body)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, mappers.ToAgentResponse(result))
}

func (m *Module) listAgents(c *gin.Context) {
	result, err := m.service.ListAgents()
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	resp := make([]*models.AgentResponse, len(result))
	for i, item := range result {
		resp[i] = mappers.ToAgentResponse(item)
	}

	c.JSON(http.StatusOK, resp)
}

func (m *Module) getAgent(c *gin.Context) {
	id := c.Param("id")

	result, err := m.service.GetAgent(c.Request.Context(), id)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, mappers.ToAgentResponse(result))
}

func (m *Module) getAgentPreferences(c *gin.Context) {
	id := c.Param("id")

	// First get the agent to ensure it exists
	agent, err := m.service.GetAgent(c.Request.Context(), id)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	// Then get the agent preferences
	preferences, err := m.service.GetPreferences(c.Request.Context(), agent)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, mappers.ToInstancePreferencesResponse(preferences))
}

func (m *Module) updateAgent(c *gin.Context) {
	id := c.Param("id")

	var body schemas.AgentUpdateSchema
	if err := c.ShouldBindJSON(&body); err != nil {
		respErr := errors.NewBadRequestError("Invalid request body", err)
		c.JSON(respErr.StatusCode, respErr)
		return
	}

	result, err := m.service.UpdateAgent(c.Request.Context(), id, &body)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, mappers.ToAgentResponse(result))
}

func (m *Module) deleteAgent(c *gin.Context) {
	id := c.Param("id")

	if err := m.service.Delete(c.Request.Context(), id); err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

func (m *Module) listAgentsTasks(c *gin.Context) {
	result, err := m.service.ListAgentsTasks(c.Request.Context())
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	tasks := make([]models.TaskResponseModel, len(result.Tasks))
	for i, item := range result.Tasks {
		tasks[i] = mappers.ToTaskResponse(item)
	}

	c.JSON(http.StatusOK, gin.H{
		"tasks":  tasks,
		"errors": result.Errors,
	})
}

func (m *Module) listAgentTasks(c *gin.Context) {
	id := c.Param("id")

	result, err := m.service.ListAgentTasks(c.Request.Context(), id)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	resp := make([]models.TaskResponseModel, len(result))
	for i, item := range result {
		resp[i] = mappers.ToTaskResponse(item)
	}

	c.JSON(http.StatusOK, resp)
}

func (m *Module) createAgentTask(c *gin.Context) {
	id := c.Param("id")

	var body schemas.TaskCreateSchema
	if err := c.ShouldBindJSON(&body); err != nil {
		respErr := errors.NewBadRequestError("Invalid request body", err)
		c.JSON(respErr.StatusCode, respErr)
		return
	}

	result, err := m.service.CreateAgentTask(c.Request.Context(), id, body)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, mappers.ToTaskResponse(result))
}

func (m *Module) stopAgentTask(c *gin.Context) {
	agentID := c.Param("id")
	taskID := c.Param("task_id")

	if err := m.service.StopAgentTask(c.Request.Context(), agentID, taskID); err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Task stopped successfully"})
}

func (m *Module) startAgentTask(c *gin.Context) {
	agentID := c.Param("id")
	taskID := c.Param("task_id")

	if err := m.service.StartAgentTask(c.Request.Context(), agentID, taskID); err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Task started successfully"})
}

func (m *Module) forceDownloadAgentTask(c *gin.Context) {
	agentID := c.Param("id")
	taskID := c.Param("task_id")

	if err := m.service.ForceDownloadAgentTask(c.Request.Context(), agentID, taskID); err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Task force download initiated successfully"})
}

func (m *Module) getAgentTask(c *gin.Context) {
	agentID := c.Param("id")
	taskID := c.Param("task_id")

	result, err := m.service.GetAgentTask(c.Request.Context(), agentID, taskID)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, mappers.ToTaskResponse(result))
}

func (m *Module) deleteAgentTask(c *gin.Context) {
	agentID := c.Param("id")
	taskID := c.Param("task_id")

	// Get purge parameter from query string
	purge := c.DefaultQuery("purge", "false") == "true"

	if err := m.service.DeleteAgentTask(c.Request.Context(), agentID, taskID, purge); err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

func (m *Module) forceResumeAgentTask(c *gin.Context) {
	agentID := c.Param("id")
	taskID := c.Param("task_id")

	if err := m.service.ForceResumeAgentTask(c.Request.Context(), agentID, taskID); err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Task force resumed successfully"})
}

func (m *Module) setAgentTaskShareLimit(c *gin.Context) {
	agentID := c.Param("id")
	taskID := c.Param("task_id")

	var body schemas.TaskSetShareLimitSchema
	if err := c.ShouldBindJSON(&body); err != nil {
		respErr := errors.NewBadRequestError("Invalid request body", err)
		c.JSON(respErr.StatusCode, respErr)
		return
	}

	if err := m.service.SetAgentTaskShareLimit(c.Request.Context(), agentID, taskID, body); err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Task share limit set successfully"})
}

func (m *Module) setAgentTaskLocation(c *gin.Context) {
	agentID := c.Param("id")
	taskID := c.Param("task_id")

	var body schemas.TaskSetLocationSchema
	if err := c.ShouldBindJSON(&body); err != nil {
		respErr := errors.NewBadRequestError("Invalid request body", err)
		c.JSON(respErr.StatusCode, respErr)
		return
	}

	if err := m.service.SetAgentTaskLocation(c.Request.Context(), agentID, taskID, body); err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Task location set successfully"})
}

func (m *Module) renameAgentTask(c *gin.Context) {
	agentID := c.Param("id")
	taskID := c.Param("task_id")

	var body schemas.TaskRenameSchema
	if err := c.ShouldBindJSON(&body); err != nil {
		respErr := errors.NewBadRequestError("Invalid request body", err)
		c.JSON(respErr.StatusCode, respErr)
		return
	}

	if err := m.service.RenameAgentTask(c.Request.Context(), agentID, taskID, body); err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Task renamed successfully"})
}

func (m *Module) setAgentTaskSuperSeeding(c *gin.Context) {
	agentID := c.Param("id")
	taskID := c.Param("task_id")

	var body schemas.TaskSuperSeedingSchema
	if err := c.ShouldBindJSON(&body); err != nil {
		respErr := errors.NewBadRequestError("Invalid request body", err)
		c.JSON(respErr.StatusCode, respErr)
		return
	}

	if err := m.service.SetAgentTaskSuperSeeding(c.Request.Context(), agentID, taskID, body); err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Task super seeding mode set successfully"})
}

func (m *Module) forceRecheckAgentTask(c *gin.Context) {
	agentID := c.Param("id")
	taskID := c.Param("task_id")

	if err := m.service.ForceRecheckAgentTask(c.Request.Context(), agentID, taskID); err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Task force recheck initiated successfully"})
}

func (m *Module) forceReannounceAgentTask(c *gin.Context) {
	agentID := c.Param("id")
	taskID := c.Param("task_id")

	if err := m.service.ForceReannounceAgentTask(c.Request.Context(), agentID, taskID); err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Task force reannounce initiated successfully"})
}

func (m *Module) setAgentTaskDownloadLimit(c *gin.Context) {
	agentID := c.Param("id")
	taskID := c.Param("task_id")

	var body schemas.TaskSetDownloadLimitSchema
	if err := c.ShouldBindJSON(&body); err != nil {
		respErr := errors.NewBadRequestError("Invalid request body", err)
		c.JSON(respErr.StatusCode, respErr)
		return
	}

	if err := m.service.SetAgentTaskDownloadLimit(c.Request.Context(), agentID, taskID, body); err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Task download limit set successfully"})
}

func (m *Module) setAgentTaskUploadLimit(c *gin.Context) {
	agentID := c.Param("id")
	taskID := c.Param("task_id")

	var body schemas.TaskSetUploadLimitSchema
	if err := c.ShouldBindJSON(&body); err != nil {
		respErr := errors.NewBadRequestError("Invalid request body", err)
		c.JSON(respErr.StatusCode, respErr)
		return
	}

	if err := m.service.SetAgentTaskUploadLimit(c.Request.Context(), agentID, taskID, body); err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Task upload limit set successfully"})
}

func (m *Module) listAgentTaskFiles(c *gin.Context) {
	agentID := c.Param("id")
	taskID := c.Param("task_id")

	files, err := m.service.ListAgentTaskFiles(c.Request.Context(), agentID, taskID)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, mappers.ToTaskFilesResponse(files))
}

func (m *Module) setAgentTaskTags(c *gin.Context) {
	agentID := c.Param("id")
	taskID := c.Param("task_id")

	var body schemas.TaskSetTagsSchema
	if err := c.ShouldBindJSON(&body); err != nil {
		respErr := errors.NewBadRequestError("Invalid request body", err)
		c.JSON(respErr.StatusCode, respErr)
		return
	}

	if err := m.service.SetAgentTaskTags(c.Request.Context(), agentID, taskID, body); err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Task tags updated successfully"})
}

func (m *Module) setAgentTaskCategory(c *gin.Context) {
	agentID := c.Param("id")
	taskID := c.Param("task_id")

	var body schemas.TaskSetCategorySchema
	if err := c.ShouldBindJSON(&body); err != nil {
		respErr := errors.NewBadRequestError("Invalid request body", err)
		c.JSON(respErr.StatusCode, respErr)
		return
	}

	if err := m.service.SetAgentTaskCategory(c.Request.Context(), agentID, taskID, body); err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Task category updated successfully"})
}

func (m *Module) getAgentTasksStats(c *gin.Context) {
	agentID := c.Param("id")

	stats, err := m.service.GetAgentTasksStats(c.Request.Context(), agentID)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, mappers.ToTaskStatsResponse(stats))
}

func (m *Module) getAgentVersion(c *gin.Context) {
	agentID := c.Param("id")

	// Check if mode=standalone querystring is present
	if c.Query("mode") == "standalone" {
		// Return current instance version for standalone mode
		c.JSON(http.StatusOK, gin.H{
			"version": version.Version,
			"commit":  version.Commit,
			"date":    version.Date,
		})
		return
	}

	version, err := m.service.GetAgentVersion(c.Request.Context(), agentID)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, mappers.ToAgentVersionResponse(version))
}

func (m *Module) getAgentTaskLimits(c *gin.Context) {
	agentID := c.Param("id")
	taskID := c.Param("task_id")

	agent, err := m.service.GetAgent(c.Request.Context(), agentID)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	limits, err := m.service.GetAgentTaskLimits(c.Request.Context(), agent, taskID)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, mappers.ToTaskLimitsResponse(limits))
}
