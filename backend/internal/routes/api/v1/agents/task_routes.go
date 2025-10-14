package agents

import (
	"net/http"

	"github.com/gardarr/gardarr/internal/entities"
	"github.com/gardarr/gardarr/internal/mappers"
	"github.com/gardarr/gardarr/internal/models"
	"github.com/gardarr/gardarr/internal/schemas"
	"github.com/gardarr/gardarr/pkg/errors"
	"github.com/gin-gonic/gin"
)

// Task route handlers for Module

func (m *Module) listAgentsTasks(c *gin.Context) {
	agents, err := m.service.ListAgents()
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	tasks, err := m.service.ListTasks(agents)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	response := make([]models.TaskResponseModel, len(tasks))
	for i, item := range tasks {
		response[i] = mappers.ToTaskResponse(item)
	}

	c.JSON(http.StatusOK, response)
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

func (m *Module) listAgentTasks(c *gin.Context) {
	id := c.Param("id")

	result, err := m.service.Get(c.Request.Context(), id)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	tasks, err := m.service.ListTasks([]*entities.Agent{result})
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	response := make([]models.TaskResponseModel, len(tasks))
	for i, item := range tasks {
		response[i] = mappers.ToTaskResponse(item)
	}

	c.JSON(http.StatusOK, response)
}
