package agents

import (
	"net/http"

	"github.com/gardarr/gardarr/internal/entities"
	"github.com/gardarr/gardarr/internal/mappers"
	"github.com/gardarr/gardarr/internal/models"
	"github.com/gardarr/gardarr/internal/schemas"
	"github.com/gardarr/gardarr/internal/services/agentmanager"
	"github.com/gin-gonic/gin"
)

type Module struct {
	service      *agentmanager.Service
	agentsRouter *gin.RouterGroup
	agentRouter  *gin.RouterGroup
}

func (m *Module) listAgentsTasks(c *gin.Context) {
	agents, err := m.service.ListAgents()
	if err != nil {
		c.JSON(http.StatusInternalServerError, err.Error())
		return
	}

	tasks, err := m.service.ListTasks(agents)
	if err != nil {
		c.JSON(http.StatusInternalServerError, err.Error())
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
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}

	result, err := m.service.CreateAgentTask(c.Request.Context(), id, body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, err.Error())
		return
	}

	c.JSON(http.StatusOK, mappers.ToTaskResponse(result))
}

func (m *Module) listAgentTasks(c *gin.Context) {
	id := c.Param("id")

	result, err := m.service.Get(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, err.Error())
		return
	}

	tasks, err := m.service.ListTasks([]*entities.Agent{result})
	if err != nil {
		c.JSON(http.StatusInternalServerError, err.Error())
		return
	}

	response := make([]models.TaskResponseModel, len(tasks))
	for i, item := range tasks {
		response[i] = mappers.ToTaskResponse(item)
	}

	c.JSON(http.StatusOK, response)
}
