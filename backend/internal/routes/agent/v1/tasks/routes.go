package tasks

import (
	"net/http"

	"github.com/gardarr/gardarr/internal/interfaces"
	"github.com/gardarr/gardarr/internal/mappers"
	"github.com/gardarr/gardarr/internal/middlewares"
	"github.com/gardarr/gardarr/internal/models"
	"github.com/gardarr/gardarr/internal/schemas"
	"github.com/gardarr/gardarr/pkg/errors"
	"github.com/gin-gonic/gin"
)

type Module struct {
	controller  interfaces.TaskService
	taskRouter  *gin.RouterGroup
	tasksRouter *gin.RouterGroup
}

func NewModule(router *gin.RouterGroup, t interfaces.TaskService, middlewares ...gin.HandlerFunc) *Module {
	return &Module{
		controller:  t,
		taskRouter:  router.Group("/task"),
		tasksRouter: router.Group("/tasks"),
	}
}

func (m Module) Register() {
	m.taskRouter.Use(middlewares.RequireAgentBearerToken())
	m.tasksRouter.Use(middlewares.RequireAgentBearerToken())

	m.tasksRouter.GET("/", m.listTasks)

	m.taskRouter.POST("/", m.createTask)
	m.taskRouter.DELETE("/:id", m.deleteTask)

	m.taskRouter.GET("/:id", m.getTask)
	m.taskRouter.POST("/:id/pause", m.pauseTask)
	m.taskRouter.POST("/:id/resume", m.resumeTask)
	m.taskRouter.POST("/:id/force_resume", m.forceResumeTask)
	m.taskRouter.POST("/:id/share_limit", m.setTaskShareLimit)
	m.taskRouter.POST("/:id/location", m.setTaskLocation)
	m.taskRouter.POST("/:id/rename", m.renameTask)
	m.taskRouter.POST("/:id/super_seeding", m.setTaskSuperSeeding)
	m.taskRouter.POST("/:id/force_recheck", m.forceRecheckTask)
	m.taskRouter.POST("/:id/force_reannounce", m.forceReannounceTask)
}

func (m *Module) listTasks(c *gin.Context) {
	result, err := m.controller.ListTasks(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, err.Error())
		return
	}

	response := make([]models.TaskResponseModel, len(result))

	for i, item := range result {
		response[i] = mappers.ToTaskResponse(item)
	}

	c.JSON(http.StatusOK, response)
}

func (m *Module) getTask(c *gin.Context) {
	result, err := m.controller.GetTask(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, err.Error())
		return
	}

	if result == nil {
		c.JSON(http.StatusNotFound, errors.ErrTaskNotFound.Error())
		return
	}

	c.JSON(http.StatusOK, mappers.ToTaskResponse(result))
}

func (m *Module) createTask(c *gin.Context) {
	var body schemas.TaskCreateSchema
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}

	result, err := m.controller.CreateTask(c.Request.Context(), body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, err.Error())
		return
	}

	c.JSON(http.StatusOK, mappers.ToTaskResponse(result))
}

func (m *Module) deleteTask(c *gin.Context) {
	var schema schemas.TaskDeleteSchema
	if err := c.ShouldBindUri(&schema); err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}

	var options schemas.TaskDeleteOptionsSchema
	if err := c.ShouldBindQuery(&options); err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}

	if err := m.controller.DeleteTask(c.Request.Context(), schema.ID, options.Purge); err != nil {
		c.JSON(http.StatusInternalServerError, err.Error())
		return
	}

	c.JSON(http.StatusOK, nil)
}

func (m *Module) pauseTask(c *gin.Context) {
	taskID := c.Param("id")
	if taskID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "task ID is required"})
		return
	}

	if err := m.controller.PauseTask(c.Request.Context(), taskID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "task paused successfully"})
}

func (m *Module) resumeTask(c *gin.Context) {
	taskID := c.Param("id")
	if taskID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "task ID is required"})
		return
	}

	if err := m.controller.ResumeTask(c.Request.Context(), taskID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "task resumed successfully"})
}

func (m *Module) forceResumeTask(c *gin.Context) {
	taskID := c.Param("id")
	if taskID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "task ID is required"})
		return
	}

	if err := m.controller.ForceResumeTask(c.Request.Context(), taskID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "task force resumed successfully"})
}

func (m *Module) setTaskShareLimit(c *gin.Context) {
	taskID := c.Param("id")
	if taskID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "task ID is required"})
		return
	}

	var body schemas.TaskSetShareLimitSchema
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Set the hash from the URL parameter
	body.Hash = taskID

	if err := m.controller.SetTaskShareLimit(c.Request.Context(), body); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "task share limit set successfully"})
}

func (m *Module) setTaskLocation(c *gin.Context) {
	taskID := c.Param("id")
	if taskID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "task ID is required"})
		return
	}

	var body schemas.TaskSetLocationSchema
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := m.controller.SetTaskLocation(c.Request.Context(), taskID, body); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "task location set successfully"})
}

func (m *Module) renameTask(c *gin.Context) {
	taskID := c.Param("id")
	if taskID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "task ID is required"})
		return
	}

	var body schemas.TaskRenameSchema
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := m.controller.RenameTask(c.Request.Context(), taskID, body); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "task renamed successfully"})
}

func (m *Module) setTaskSuperSeeding(c *gin.Context) {
	taskID := c.Param("id")
	if taskID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "task ID is required"})
		return
	}

	var body schemas.TaskSuperSeedingSchema
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := m.controller.SetTaskSuperSeeding(c.Request.Context(), taskID, body); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "task super seeding mode set successfully"})
}

func (m *Module) forceRecheckTask(c *gin.Context) {
	taskID := c.Param("id")
	if taskID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "task ID is required"})
		return
	}

	if err := m.controller.ForceRecheckTask(c.Request.Context(), taskID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "task force recheck initiated successfully"})
}

func (m *Module) forceReannounceTask(c *gin.Context) {
	taskID := c.Param("id")
	if taskID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "task ID is required"})
		return
	}

	if err := m.controller.ForceReannounceTask(c.Request.Context(), taskID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "task force reannounce initiated successfully"})
}
