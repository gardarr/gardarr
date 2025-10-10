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
