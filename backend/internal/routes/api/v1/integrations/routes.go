package integrations

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jfxdev/gardarr/internal/entities"
	"github.com/jfxdev/gardarr/internal/infra/database"
	"github.com/jfxdev/gardarr/internal/middlewares"
	"github.com/jfxdev/gardarr/internal/models"
	"github.com/jfxdev/gardarr/internal/repository/webhook"
	"github.com/jfxdev/gardarr/internal/repository/webhook_history"
	"github.com/jfxdev/gardarr/internal/schemas"
	"github.com/jfxdev/gardarr/internal/services/integration"
)

// Module holds integrations routes configuration
type Module struct {
	group              *gin.RouterGroup
	webhookRepo        *webhook.Repository
	webhookHistoryRepo *webhook_history.Repository
	db                 *database.Database
	integrationService *integration.Service
}

// NewModule creates a new integrations module
func NewModule(router *gin.RouterGroup, db *database.Database, integrationSvc *integration.Service) *Module {
	return &Module{
		group:              router.Group("/integrations"),
		webhookRepo:        webhook.NewRepository(db),
		webhookHistoryRepo: webhook_history.NewRepository(db),
		db:                 db,
		integrationService: integrationSvc,
	}
}

const (
	errRequiredWebhookID      = "Webhook ID is required"
	errInvalidWebhookIDFormat = "Invalid webhook ID format"
)

// Register registers all integration routes
func (m *Module) Register() {
	// Apply authentication middleware to all routes
	m.group.Use(middlewares.SessionMiddleware(m.db))

	// Webhook routes
	webhooks := m.group.Group("/webhooks")
	{
		webhooks.POST("", m.createWebhook)
		webhooks.GET("", m.listWebhooks)
		webhooks.GET("/:id", m.getWebhookByID)
		webhooks.PUT("/:id", m.updateWebhook)
		webhooks.DELETE("/:id", m.deleteWebhook)
		webhooks.GET("/:id/history", m.getWebhookHistory)
	}

	// Webhook history routes
	history := m.group.Group("/webhook-history")
	{
		history.GET("", m.listWebhookHistory)
		history.GET("/:id", m.getWebhookHistoryByID)
	}
}

// createWebhook creates a new webhook
func (m *Module) createWebhook(c *gin.Context) {
	var body schemas.WebhookCreateRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Validation failed",
			"details": err.Error(),
		})
		return
	}

	// Default timeout to 10 seconds if not provided or invalid
	timeoutSeconds := body.TimeoutSeconds
	if timeoutSeconds <= 0 {
		timeoutSeconds = 10
	}

	webhook := entities.Webhook{
		UUID:               uuid.New(),
		URL:                body.URL,
		InsecureSkipVerify: body.InsecureSkipVerify,
		Enabled:            true,
		TimeoutSeconds:     timeoutSeconds,
	}

	// Add filter if provided
	if body.Filter != nil {
		webhook.Filter = &entities.EventFilter{
			UUID:            uuid.New(),
			EventTypeFilter: body.Filter.EventTypeFilter,
			StatusFilter:    body.Filter.StatusFilter,
			CategoryFilter:  body.Filter.CategoryFilter,
			NameTerms:       body.Filter.NameTerms,
		}
	}

	created, err := m.webhookRepo.CreateWebhook(c.Request.Context(), webhook)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create webhook"})
		return
	}

	// Reload webhooks in integration service
	if m.integrationService != nil {
		m.integrationService.ReloadWebhooks(c.Request.Context())
	}

	c.JSON(http.StatusCreated, m.toResponse(created))
}

// listWebhooks retrieves all webhooks
func (m *Module) listWebhooks(c *gin.Context) {
	webhooks, err := m.webhookRepo.ListWebhooks(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve webhooks"})
		return
	}

	response := make([]models.WebhookResponse, len(webhooks))
	for i, wh := range webhooks {
		response[i] = m.toResponse(wh)
	}

	c.JSON(http.StatusOK, response)
}

// getWebhookByID retrieves a webhook by its UUID
func (m *Module) getWebhookByID(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": errRequiredWebhookID})
		return
	}

	webhookUUID, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": errInvalidWebhookIDFormat})
		return
	}

	wh, err := m.webhookRepo.GetWebhookByUUID(c.Request.Context(), webhookUUID)
	if err != nil {
		if errors.Is(err, webhook.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, m.toResponse(wh))
}

// updateWebhook updates an existing webhook
func (m *Module) updateWebhook(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": errRequiredWebhookID})
		return
	}

	webhookUUID, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": errInvalidWebhookIDFormat})
		return
	}

	var body schemas.WebhookUpdateRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Validation failed",
			"details": err.Error(),
		})
		return
	}

	// Get existing webhook
	existing, err := m.webhookRepo.GetWebhookByUUID(c.Request.Context(), webhookUUID)
	if err != nil {
		if errors.Is(err, webhook.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Update only provided fields
	updated := entities.Webhook{
		UUID:               existing.UUID,
		URL:                existing.URL,
		InsecureSkipVerify: existing.InsecureSkipVerify,
		Enabled:            existing.Enabled,
		TimeoutSeconds:     existing.TimeoutSeconds,
	}

	if body.URL != nil {
		updated.URL = *body.URL
	}
	if body.InsecureSkipVerify != nil {
		updated.InsecureSkipVerify = *body.InsecureSkipVerify
	}
	if body.Enabled != nil {
		updated.Enabled = *body.Enabled
	}
	if body.TimeoutSeconds != nil {
		updated.TimeoutSeconds = *body.TimeoutSeconds
	}

	// Update filter if provided in request
	if body.Filter != nil {
		updated.Filter = &entities.EventFilter{
			UUID:            uuid.New(),
			EventTypeFilter: body.Filter.EventTypeFilter,
			StatusFilter:    body.Filter.StatusFilter,
			CategoryFilter:  body.Filter.CategoryFilter,
			NameTerms:       body.Filter.NameTerms,
		}
	}

	result, err := m.webhookRepo.UpdateWebhook(c.Request.Context(), updated)
	if err != nil {
		if errors.Is(err, webhook.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Reload webhooks in integration service
	if m.integrationService != nil {
		m.integrationService.ReloadWebhooks(c.Request.Context())
	}

	c.JSON(http.StatusOK, m.toResponse(result))
}

// deleteWebhook removes a webhook by UUID
func (m *Module) deleteWebhook(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": errRequiredWebhookID})
		return
	}

	webhookUUID, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": errInvalidWebhookIDFormat})
		return
	}

	if err := m.webhookRepo.DeleteWebhook(c.Request.Context(), webhookUUID); err != nil {
		if errors.Is(err, webhook.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Reload webhooks in integration service
	if m.integrationService != nil {
		m.integrationService.ReloadWebhooks(c.Request.Context())
	}

	c.JSON(http.StatusNoContent, nil)
}

// toResponse converts an entity to a response model
func (m *Module) toResponse(wh *entities.Webhook) models.WebhookResponse {
	response := models.WebhookResponse{
		UUID:               wh.UUID.String(),
		URL:                wh.URL,
		InsecureSkipVerify: wh.InsecureSkipVerify,
		Enabled:            wh.Enabled,
		TimeoutSeconds:     wh.TimeoutSeconds,
		CreatedAt:          wh.CreatedAt,
		UpdatedAt:          wh.UpdatedAt,
	}

	// Add filter if present
	if wh.Filter != nil {
		response.Filter = &models.EventFilterResponse{
			UUID:            wh.Filter.UUID.String(),
			IntegrationID:   wh.Filter.IntegrationID.String(),
			IntegrationType: string(wh.Filter.IntegrationType),
			EventTypeFilter: wh.Filter.EventTypeFilter,
			StatusFilter:    wh.Filter.StatusFilter,
			CategoryFilter:  wh.Filter.CategoryFilter,
			NameTerms:       wh.Filter.NameTerms,
			CreatedAt:       wh.Filter.CreatedAt,
			UpdatedAt:       wh.Filter.UpdatedAt,
		}
	}

	return response
}

// getWebhookHistory retrieves webhook history for a specific webhook
func (m *Module) getWebhookHistory(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": errRequiredWebhookID})
		return
	}

	webhookUUID, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": errInvalidWebhookIDFormat})
		return
	}

	// Parse pagination parameters
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	if limit > 100 {
		limit = 100
	}

	history, err := m.webhookHistoryRepo.ListWebhookHistory(c.Request.Context(), &webhookUUID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve webhook history"})
		return
	}

	count, err := m.webhookHistoryRepo.CountWebhookHistory(c.Request.Context(), &webhookUUID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to count webhook history"})
		return
	}

	response := make([]models.WebhookHistoryResponse, len(history))
	for i, h := range history {
		response[i] = m.toWebhookHistoryResponse(h)
	}

	c.JSON(http.StatusOK, gin.H{
		"data":   response,
		"total":  count,
		"limit":  limit,
		"offset": offset,
	})
}

// listWebhookHistory retrieves all webhook history with pagination
func (m *Module) listWebhookHistory(c *gin.Context) {
	// Parse pagination parameters
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	if limit > 100 {
		limit = 100
	}

	history, err := m.webhookHistoryRepo.ListWebhookHistory(c.Request.Context(), nil, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve webhook history"})
		return
	}

	count, err := m.webhookHistoryRepo.CountWebhookHistory(c.Request.Context(), nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to count webhook history"})
		return
	}

	response := make([]models.WebhookHistoryResponse, len(history))
	for i, h := range history {
		response[i] = m.toWebhookHistoryResponse(h)
	}

	c.JSON(http.StatusOK, gin.H{
		"data":   response,
		"total":  count,
		"limit":  limit,
		"offset": offset,
	})
}

// toWebhookHistoryResponse converts an entity to a response model
func (m *Module) toWebhookHistoryResponse(h *entities.WebhookHistory) models.WebhookHistoryResponse {
	return models.WebhookHistoryResponse{
		UUID:         h.UUID.String(),
		WebhookID:    h.WebhookID.String(),
		TaskHash:     h.TaskHash,
		TaskName:     h.TaskName,
		TaskStatus:   h.TaskStatus,
		StatusCode:   h.StatusCode,
		ResponseBody: h.ResponseBody,
		RequestBody:  h.RequestBody,
		Error:        h.Error,
		CreatedAt:    h.CreatedAt,
	}
}

// getWebhookHistoryByID retrieves a specific webhook history record by its UUID
func (m *Module) getWebhookHistoryByID(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "History ID is required"})
		return
	}

	historyUUID, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid history ID format"})
		return
	}

	// Get the history record
	history, err := m.webhookHistoryRepo.GetWebhookHistoryByID(c.Request.Context(), historyUUID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Webhook history not found"})
		return
	}

	c.JSON(http.StatusOK, m.toWebhookHistoryResponse(history))
}
