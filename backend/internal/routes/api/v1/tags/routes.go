package tags

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jfxdev/gardarr/internal/entities"
	"github.com/jfxdev/gardarr/internal/infra/database"
	"github.com/jfxdev/gardarr/internal/middlewares"
	"github.com/jfxdev/gardarr/internal/models"
	"github.com/jfxdev/gardarr/internal/schemas"
	"github.com/jfxdev/gardarr/internal/services/tag"
	"github.com/jfxdev/gardarr/internal/services/workermanager"
)

// Module holds tag routes configuration
type Module struct {
	group   *gin.RouterGroup
	service *tag.Service
	db      *database.Database
}

// NewModule creates a new tags module
func NewModule(router *gin.RouterGroup, db *database.Database, workers *workermanager.Service) *Module {
	return &Module{
		group:   router.Group("/tags"),
		service: tag.NewService(db, workers),
		db:      db,
	}
}

// Register registers all tag routes
func (m *Module) Register() {
	m.group.Use(middlewares.SessionMiddleware(m.db))

	m.group.POST("", m.createTag)
	m.group.GET("", m.listTags)
	m.group.PUT("/:id", m.updateTag)
}

// createTag creates a new tag
func (m *Module) createTag(c *gin.Context) {
	var body schemas.TagCreateRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Validation failed",
			"details": err.Error(),
		})
		return
	}

	created, err := m.service.CreateTag(c.Request.Context(), entities.Tag{
		Name:  body.Name,
		Kind:  defaultTagKind(body.Kind),
		Color: body.Color,
		Icon:  body.Icon,
	})
	if err != nil {
		statusCode := http.StatusInternalServerError
		if err.Error() == "tag already exists" {
			statusCode = http.StatusConflict
		}
		c.JSON(statusCode, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, m.toResponse(created, 0))
}

// listTags retrieves the union of stored and live-observed tags
func (m *Module) listTags(c *gin.Context) {
	list, err := m.service.ListTags(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve tags"})
		return
	}

	response := make([]models.TagResponse, len(list))
	for i, t := range list {
		response[i] = m.toResponse(t, t.UsageCount)
	}

	c.JSON(http.StatusOK, response)
}

// updateTag updates an existing tag's color/icon
func (m *Module) updateTag(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tag ID is required"})
		return
	}

	var body schemas.TagUpdateRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Validation failed",
			"details": err.Error(),
		})
		return
	}

	existing, err := m.service.GetTagByID(c.Request.Context(), id)
	if err != nil {
		statusCode := http.StatusInternalServerError
		if err.Error() == "tag not found" {
			statusCode = http.StatusNotFound
		}
		c.JSON(statusCode, gin.H{"error": err.Error()})
		return
	}

	updated := entities.Tag{
		ID:    id,
		Name:  existing.Name,
		Kind:  existing.Kind,
		Color: existing.Color,
		Icon:  existing.Icon,
	}
	if body.Color != "" {
		updated.Color = body.Color
	}
	if body.Icon != "" {
		updated.Icon = body.Icon
	}

	result, err := m.service.UpdateTag(c.Request.Context(), updated)
	if err != nil {
		statusCode := http.StatusInternalServerError
		if err.Error() == "tag not found" {
			statusCode = http.StatusNotFound
		}
		c.JSON(statusCode, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, m.toResponse(result, 0))
}

// toResponse converts an entity to a response model
func (m *Module) toResponse(t *entities.Tag, usageCount int) models.TagResponse {
	return models.TagResponse{
		ID:         t.ID,
		Name:       t.Name,
		Kind:       models.TagKind(t.Kind),
		Color:      t.Color,
		Icon:       t.Icon,
		UsageCount: usageCount,
		CreatedAt:  t.CreatedAt,
		UpdatedAt:  t.UpdatedAt,
	}
}

func defaultTagKind(value string) entities.TagKind {
	if value == "" {
		return entities.TagKindTag
	}
	return entities.TagKind(value)
}
