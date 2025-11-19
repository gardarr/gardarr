package task_metadata

import (
	"net/http"
	"os"
	"strings"

	"github.com/gardarr/gardarr/internal/infra/database"
	"github.com/gardarr/gardarr/internal/mappers"
	"github.com/gardarr/gardarr/internal/middlewares"
	task_metadata_service "github.com/gardarr/gardarr/internal/services/task_metadata"
	"github.com/gin-gonic/gin"
)

// Module holds task metadata routes configuration
type Module struct {
	group   *gin.RouterGroup
	service *task_metadata_service.Service
	db      *database.Database
}

// NewModule creates a new task metadata module
func NewModule(router *gin.RouterGroup, db *database.Database, baseURL string) *Module {
	return &Module{
		group:   router.Group("/tasks/metadata"),
		service: task_metadata_service.NewService(db, baseURL),
		db:      db,
	}
}

// Register registers all task metadata routes
func (m *Module) Register() {
	// Protected routes - require authentication
	protected := m.group.Group("")
	protected.Use(middlewares.SessionMiddleware(m.db))

	// Metadata management - write operations
	protected.PUT("/:task_hash/description", m.updateTaskDescription)
	protected.PUT("/:task_hash/position", m.updateImagePosition)
	protected.PUT("/:task_hash/opacity", m.updateImageOpacity)

	// Image management - write operations
	protected.POST("/:task_hash/image", m.uploadTaskImage)
	protected.DELETE("/:task_hash/image", m.deleteTaskImage)

	// Image serving - read operations (also protected)
	protected.GET("/:task_hash/image", m.getTaskImage)
	protected.GET("/:task_hash/thumbnail", m.getTaskThumbnail)
}

// uploadTaskImage handles image upload for a task
func (m *Module) uploadTaskImage(c *gin.Context) {
	taskHash := c.Param("task_hash")
	if taskHash == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "task_hash is required",
		})
		return
	}

	// Get uploaded file
	file, header, err := c.Request.FormFile("image")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "image file is required",
		})
		return
	}
	defer file.Close()

	// Upload image
	metadata, err := m.service.UploadImage(c.Request.Context(), taskHash, file, header)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, mappers.ToTaskMetadataResponse(metadata))
}

// updateTaskDescription updates the description of task metadata
func (m *Module) updateTaskDescription(c *gin.Context) {
	taskHash := c.Param("task_hash")
	if taskHash == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "task_hash is required",
		})
		return
	}

	// Parse request body
	var body struct {
		Description string `json:"description"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid request body",
		})
		return
	}

	// Update description
	metadata, err := m.service.UpdateDescription(c.Request.Context(), taskHash, body.Description)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, mappers.ToTaskMetadataResponse(metadata))
}

// updateImagePosition updates the position of the image
func (m *Module) updateImagePosition(c *gin.Context) {
	taskHash := c.Param("task_hash")
	if taskHash == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "task_hash is required",
		})
		return
	}

	// Parse request body
	var body struct {
		ImagePositionY float64 `json:"image_position_y"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid request body",
		})
		return
	}

	// Update position
	metadata, err := m.service.UpdateImagePosition(c.Request.Context(), taskHash, body.ImagePositionY)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, mappers.ToTaskMetadataResponse(metadata))
}

// updateImageOpacity updates the opacity of the image
func (m *Module) updateImageOpacity(c *gin.Context) {
	taskHash := c.Param("task_hash")
	if taskHash == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "task_hash is required",
		})
		return
	}

	// Parse request body
	var body struct {
		ImageOpacity float64 `json:"image_opacity"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid request body",
		})
		return
	}

	// Update opacity
	metadata, err := m.service.UpdateImageOpacity(c.Request.Context(), taskHash, body.ImageOpacity)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, mappers.ToTaskMetadataResponse(metadata))
}

// deleteTaskImage deletes the image from task metadata
func (m *Module) deleteTaskImage(c *gin.Context) {
	taskHash := c.Param("task_hash")
	if taskHash == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "task_hash is required",
		})
		return
	}

	// Delete image
	if err := m.service.DeleteImage(c.Request.Context(), taskHash); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.Status(http.StatusNoContent)
}

// getTaskImage serves the task image
func (m *Module) getTaskImage(c *gin.Context) {
	taskHash := c.Param("task_hash")
	if taskHash == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "task_hash is required",
		})
		return
	}

	// Validate task hash to prevent path traversal in URL parameter
	if strings.Contains(taskHash, "..") || strings.Contains(taskHash, "/") || strings.Contains(taskHash, "\\") {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid task_hash",
		})
		return
	}

	// Get image path (service validates path is within upload directory)
	imagePath, err := m.service.GetImagePath(c.Request.Context(), taskHash)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "image not found",
		})
		return
	}

	// Check if file exists
	if _, err := os.Stat(imagePath); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "image file not found",
		})
		return
	}

	// Serve file (path is validated to be within upload directory)
	c.File(imagePath)
}

// getTaskThumbnail serves a thumbnail of the task image
func (m *Module) getTaskThumbnail(c *gin.Context) {
	taskHash := c.Param("task_hash")
	if taskHash == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "task_hash is required",
		})
		return
	}

	// Validate task hash to prevent path traversal in URL parameter
	if strings.Contains(taskHash, "..") || strings.Contains(taskHash, "/") || strings.Contains(taskHash, "\\") {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid task_hash",
		})
		return
	}

	// Get image path (service validates path is within upload directory)
	imagePath, err := m.service.GetImagePath(c.Request.Context(), taskHash)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "image not found",
		})
		return
	}

	// Check if file exists
	if _, err := os.Stat(imagePath); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "image file not found",
		})
		return
	}

	// TODO: Generate and serve actual thumbnail
	// For now, serve the full image (path is validated to be within upload directory)
	c.File(imagePath)
}
