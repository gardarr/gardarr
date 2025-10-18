package agents

import (
	"net/http"

	"github.com/gardarr/gardarr/internal/mappers"
	"github.com/gardarr/gardarr/internal/models"
	"github.com/gardarr/gardarr/internal/schemas"
	"github.com/gardarr/gardarr/internal/services/agentmanager"
	"github.com/gardarr/gardarr/pkg/errors"
	"github.com/gin-gonic/gin"
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
	m.agentRouter.GET("/:id/tasks", m.listAgentTasks)
	m.agentRouter.GET("/:id/preferences", m.getAgentPreferences)
	m.agentRouter.DELETE("/:id", m.deleteAgent)
	m.agentRouter.POST("/:id/task", m.createAgentTask)
	m.agentRouter.POST("/:id/tasks/:task_id/pause", m.pauseAgentTask)
	m.agentRouter.POST("/:id/tasks/:task_id/resume", m.resumeAgentTask)
	m.agentRouter.POST("/:id/tasks/:task_id/force-download", m.forceDownloadAgentTask)
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

	result, err := m.service.Get(c.Request.Context(), id)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, mappers.ToAgentResponse(result))
}

func (m *Module) getAgentPreferences(c *gin.Context) {
	id := c.Param("id")

	// First get the agent to ensure it exists
	agent, err := m.service.Get(c.Request.Context(), id)
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
	result, err := m.service.ListAgentsTasks()
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

func (m *Module) pauseAgentTask(c *gin.Context) {
	agentID := c.Param("id")
	taskID := c.Param("task_id")

	if err := m.service.PauseAgentTask(c.Request.Context(), agentID, taskID); err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Task paused successfully"})
}

func (m *Module) resumeAgentTask(c *gin.Context) {
	agentID := c.Param("id")
	taskID := c.Param("task_id")

	if err := m.service.ResumeAgentTask(c.Request.Context(), agentID, taskID); err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Task resumed successfully"})
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
