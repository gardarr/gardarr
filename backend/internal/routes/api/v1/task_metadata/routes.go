package task_metadata

import (
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jfxdev/gardarr/internal/infra/database"
	"github.com/jfxdev/gardarr/internal/mappers"
	"github.com/jfxdev/gardarr/internal/middlewares"
	task_metadata_service "github.com/jfxdev/gardarr/internal/services/task_metadata"
)

const (
	// MaxImageUploadSize defines the maximum allowed image upload size (5MB)
	MaxImageUploadSize = 5 * 1024 * 1024 // 5MB
)

var (
	// AllowedImageMIMETypes defines the permitted image MIME types
	AllowedImageMIMETypes = map[string]bool{
		"image/jpeg": true,
		"image/png":  true,
		"image/gif":  true,
		"image/webp": true,
	}
)

// Module holds task metadata routes configuration
type Module struct {
	group   *gin.RouterGroup
	service *task_metadata_service.Service
	db      *database.Database
}

// NewModule creates a new task metadata module
func NewModule(router *gin.RouterGroup, db *database.Database, service *task_metadata_service.Service) *Module {
	return &Module{
		group:   router.Group("/tasks/metadata"),
		service: service,
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
	protected.PUT("/:task_hash/name", m.updateTaskName)
	protected.PUT("/:task_hash/position", m.updateImagePosition)
	protected.PUT("/:task_hash/opacity", m.updateImageOpacity)

	// Image management - write operations
	protected.POST("/:task_hash/image", m.uploadTaskImage)
	protected.DELETE("/:task_hash/image", m.deleteTaskImage)

	// Image serving - read operations (also protected)
	protected.GET("/:task_hash/image", m.getTaskImage)
	protected.GET("/:task_hash/thumbnail", m.getTaskThumbnail)

	// External metadata providers
	protected.GET("/providers/:provider/status", m.providerStatus)
	protected.GET("/:task_hash/providers/:provider/search", m.searchProvider)
	protected.POST("/:task_hash/providers/:provider", m.applyProvider)
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

	// Validate file size
	if header.Size > MaxImageUploadSize {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("image file exceeds maximum size of %dMB", MaxImageUploadSize/1024/1024),
		})
		return
	}

	// Validate Content-Type header
	contentType := header.Header.Get("Content-Type")
	if !AllowedImageMIMETypes[contentType] {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid image type; only JPEG, PNG, GIF, and WebP are allowed",
		})
		return
	}

	// Sniff file content to confirm actual MIME type
	// Read first 512 bytes for detection (http.DetectContentType uses up to 512 bytes)
	buffer := make([]byte, 512)
	n, err := file.Read(buffer)
	if err != nil && err != io.EOF {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "failed to read image file",
		})
		return
	}

	// Detect actual content type from file content
	detectedType := http.DetectContentType(buffer[:n])
	if !AllowedImageMIMETypes[detectedType] {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "image file content does not match allowed types",
		})
		return
	}

	// Reset file pointer to beginning for service to read
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to process image file",
		})
		return
	}

	// Upload validated image (size already checked via header.Size)
	metadata, err := m.service.UploadImage(c.Request.Context(), taskHash, file, header)
	if err != nil {
		slog.Error("failed to upload image", "error", err, "task_hash", taskHash)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to upload image"})
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

// updateTaskName updates the name of task metadata
func (m *Module) updateTaskName(c *gin.Context) {
	taskHash := c.Param("task_hash")
	if taskHash == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "task_hash is required",
		})
		return
	}

	// Parse request body
	var body struct {
		Name string `json:"name"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid request body",
		})
		return
	}

	// Update name
	metadata, err := m.service.UpdateName(c.Request.Context(), taskHash, body.Name)
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

	c.File(imagePath)
}

// providerStatus returns the status of an external metadata provider
func (m *Module) providerStatus(c *gin.Context) {
	provider := c.Param("provider")
	if provider == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "provider is required"})
		return
	}

	status, err := m.service.GetProviderStatus(c.Request.Context(), provider)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, status)
}

// searchProvider searches an external metadata provider
func (m *Module) searchProvider(c *gin.Context) {
	provider := c.Param("provider")
	if provider == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "provider is required"})
		return
	}

	query := c.Query("q")
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "query parameter 'q' is required"})
		return
	}

	results, err := m.service.SearchProvider(c.Request.Context(), provider, query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, results)
}

// applyProvider applies provider metadata to a task
func (m *Module) applyProvider(c *gin.Context) {
	provider := c.Param("provider")
	if provider == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "provider is required"})
		return
	}

	taskHash := c.Param("task_hash")
	if taskHash == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "task_hash is required"})
		return
	}

	var body struct {
		ID string `json:"id"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	if strings.TrimSpace(body.ID) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id is required"})
		return
	}

	metadata, err := m.service.ApplyProviderSelection(c.Request.Context(), provider, taskHash, body.ID)
	if err != nil {
		switch {
		case errors.Is(err, task_metadata_service.ErrProviderNotFound), errors.Is(err, task_metadata_service.ErrProviderSelectionNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}

	c.JSON(http.StatusOK, mappers.ToTaskMetadataResponse(metadata))
}
