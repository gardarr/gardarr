package integrations

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jfxdev/gardarr/internal/entities"
	"github.com/jfxdev/gardarr/internal/infra/database"
	"github.com/jfxdev/gardarr/internal/middlewares"
	"github.com/jfxdev/gardarr/internal/models"
	"github.com/jfxdev/gardarr/internal/repository/webhook"
	"github.com/jfxdev/gardarr/internal/schemas"
	"github.com/jfxdev/gardarr/internal/services/integration"
)

// Module holds integrations routes configuration
type Module struct {
	group              *gin.RouterGroup
	webhookRepo        *webhook.Repository
	db                 *database.Database
	integrationService *integration.Service
}

// NewModule creates a new integrations module
func NewModule(router *gin.RouterGroup, db *database.Database, integrationSvc *integration.Service) *Module {
	return &Module{
		group:              router.Group("/integrations"),
		webhookRepo:        webhook.NewRepository(db),
		db:                 db,
		integrationService: integrationSvc,
	}
}

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
		c.JSON(http.StatusBadRequest, gin.H{"error": "Webhook ID is required"})
		return
	}

	webhookUUID, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid webhook ID format"})
		return
	}

	webhook, err := m.webhookRepo.GetWebhookByUUID(c.Request.Context(), webhookUUID)
	if err != nil {
		statusCode := http.StatusInternalServerError
		if err.Error() == "webhook not found" {
			statusCode = http.StatusNotFound
		}
		c.JSON(statusCode, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, m.toResponse(webhook))
}

// updateWebhook updates an existing webhook
func (m *Module) updateWebhook(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Webhook ID is required"})
		return
	}

	webhookUUID, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid webhook ID format"})
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
		statusCode := http.StatusInternalServerError
		if err.Error() == "webhook not found" {
			statusCode = http.StatusNotFound
		}
		c.JSON(statusCode, gin.H{"error": err.Error()})
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
		statusCode := http.StatusInternalServerError
		if err.Error() == "webhook not found" {
			statusCode = http.StatusNotFound
		}
		c.JSON(statusCode, gin.H{"error": err.Error()})
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "Webhook ID is required"})
		return
	}

	webhookUUID, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid webhook ID format"})
		return
	}

	if err := m.webhookRepo.DeleteWebhook(c.Request.Context(), webhookUUID); err != nil {
		statusCode := http.StatusInternalServerError
		if err.Error() == "webhook not found" {
			statusCode = http.StatusNotFound
		}
		c.JSON(statusCode, gin.H{"error": err.Error()})
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
