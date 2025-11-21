package events

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jfxdev/gardarr/internal/infra/database"
	"github.com/jfxdev/gardarr/internal/mappers"
	"github.com/jfxdev/gardarr/internal/middlewares"
	"github.com/jfxdev/gardarr/internal/models"
	"github.com/jfxdev/gardarr/internal/services/events"
)

// Module holds events routes configuration
type Module struct {
	group        *gin.RouterGroup
	eventService *events.Service
	db           *database.Database
}

// NewModule creates a new events module
func NewModule(router *gin.RouterGroup, db *database.Database) *Module {
	return &Module{
		group:        router.Group("/events"),
		eventService: events.NewService(db),
		db:           db,
	}
}

// Register registers all events routes
func (m *Module) Register() {
	// Protected routes - require authentication
	protected := m.group.Group("")
	protected.Use(middlewares.SessionMiddleware(m.db))
	protected.GET("/", m.listEvents)
	protected.GET("/:uuid", m.getEvent)
}

// listEvents retrieves events with optional filters
func (m *Module) listEvents(c *gin.Context) {
	// Parse query parameters
	agentIDStr := c.Query("agent_id")
	eventType := c.Query("type")
	limitStr := c.DefaultQuery("limit", "50")
	offsetStr := c.DefaultQuery("offset", "0")

	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 {
		limit = 50
	}
	if limit > 200 {
		limit = 200 // Max limit
	}

	offset, err := strconv.Atoi(offsetStr)
	if err != nil || offset < 0 {
		offset = 0
	}

	var agentID *uuid.UUID
	if agentIDStr != "" {
		if parsed, err := uuid.Parse(agentIDStr); err == nil {
			agentID = &parsed
		}
	}

	var eventTypePtr *string
	if eventType != "" {
		eventTypePtr = &eventType
	}

	// Get events from service
	eventsList, total, err := m.eventService.ListEvents(c.Request.Context(), agentID, eventTypePtr, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to retrieve events",
		})
		return
	}

	// Convert to response
	eventResponses := make([]*models.EventResponse, len(eventsList))
	for i, event := range eventsList {
		eventResponses[i] = mappers.ToEventResponse(event)
	}

	resp := models.ListEventsResponse{
		Events: eventResponses,
		Total:  int(total),
	}

	c.JSON(http.StatusOK, resp)
}

// getEvent retrieves a single event by UUID
func (m *Module) getEvent(c *gin.Context) {
	uuidStr := c.Param("uuid")
	if uuidStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "UUID is required",
		})
		return
	}

	eventUUID, err := uuid.Parse(uuidStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid UUID format",
		})
		return
	}

	event, err := m.eventService.GetEventByUUID(c.Request.Context(), eventUUID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Event not found",
		})
		return
	}

	c.JSON(http.StatusOK, mappers.ToEventResponse(event))
}
