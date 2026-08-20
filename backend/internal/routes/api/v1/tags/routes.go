package tags

import (
	"errors"
	"net/http"
	"strings"

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
	m.group.GET("/conflicts", m.getConflicts)
	m.group.PUT("/:id", m.updateTag)
	m.group.DELETE("", m.deleteTag)
	m.group.POST("/rename", m.renameTag)
	m.group.POST("/merge", m.mergeTags)
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

// getConflicts reports backward-compatibility issues the scoped-tag rules
// introduce for existing data: torrents holding multiple values for the
// same exclusive scope, and tags using a single ":" worth reviewing.
func (m *Module) getConflicts(c *gin.Context) {
	report, err := m.service.DetectConflicts(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to detect tag conflicts"})
		return
	}

	c.JSON(http.StatusOK, report)
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

// deleteTag removes a tag from every worker (unless it's a scope row,
// which has no counterpart on qBittorrent) and, unless every worker
// failed, its local row.
func (m *Module) deleteTag(c *gin.Context) {
	name := strings.TrimSpace(c.Query("name"))
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		return
	}

	kindParam := c.Query("kind")
	if kindParam != "" && kindParam != string(entities.TagKindTag) && kindParam != string(entities.TagKindScope) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "kind must be 'tag' or 'scope'"})
		return
	}

	failed, err := m.service.DeleteTag(c.Request.Context(), entities.TagKind(kindParam), name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"failed_workers": failed})
}

// renameTag is a merge with a single source (see mergeTags).
func (m *Module) renameTag(c *gin.Context) {
	var body schemas.TagRenameRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Validation failed",
			"details": err.Error(),
		})
		return
	}

	failed, err := m.service.RenameTag(c.Request.Context(), body.From, body.To)
	if err != nil {
		statusCode := http.StatusInternalServerError
		if errors.Is(err, tag.ErrMergeTargetInSources) {
			statusCode = http.StatusBadRequest
		}
		c.JSON(statusCode, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"failed_workers": failed})
}

// mergeTags applies target to every torrent (on every worker) that
// currently holds any of sources, then deregisters sources.
func (m *Module) mergeTags(c *gin.Context) {
	var body schemas.TagMergeRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Validation failed",
			"details": err.Error(),
		})
		return
	}

	failed, err := m.service.MergeTags(c.Request.Context(), body.Sources, body.Target)
	if err != nil {
		statusCode := http.StatusInternalServerError
		if errors.Is(err, tag.ErrMergeTargetInSources) {
			statusCode = http.StatusBadRequest
		}
		c.JSON(statusCode, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"failed_workers": failed})
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
