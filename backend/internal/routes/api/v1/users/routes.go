package users

import (
	"net/http"

	"github.com/gardarr/gardarr/internal/infra/database"
	"github.com/gardarr/gardarr/internal/mappers"
	"github.com/gardarr/gardarr/internal/middlewares"
	"github.com/gardarr/gardarr/internal/models"
	"github.com/gardarr/gardarr/internal/services/auth"
	"github.com/gardarr/gardarr/internal/services/user"
	"github.com/gin-gonic/gin"
)

// Module holds users routes configuration
type Module struct {
	group       *gin.RouterGroup
	userService *user.Service
	authService *auth.Service
	db          *database.Database
}

// NewModule creates a new users module
func NewModule(router *gin.RouterGroup, db *database.Database) *Module {
	return &Module{
		group:       router.Group("/users"),
		userService: user.NewService(db),
		authService: auth.NewService(db),
		db:          db,
	}
}

// Register registers all users routes
func (m *Module) Register() {
	// Protected routes - require authentication
	protected := m.group.Group("")
	protected.Use(middlewares.SessionMiddleware(m.db))
	protected.Use(middlewares.RequireAdminRole())
	protected.GET("/", m.listUsers)
	protected.DELETE("/:uuid", m.deleteUser)
	protected.POST("/:uuid/password/request_reset", m.requestPasswordReset)
}

// listUsers retrieves all users
func (m *Module) listUsers(c *gin.Context) {
	users, err := m.userService.ListUsers(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to retrieve users",
		})
		return
	}

	userResponses := make([]*models.UserResponse, len(users))
	for i, u := range users {
		userResponses[i] = mappers.ToUserResponse(u)
	}

	resp := models.ListUsersResponse{
		Users: userResponses,
		Total: len(userResponses),
	}

	c.JSON(http.StatusOK, resp)
}

// deleteUser deletes a user by UUID
func (m *Module) deleteUser(c *gin.Context) {
	uuid := c.Param("uuid")
	if uuid == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "UUID is required",
		})
		return
	}

	err := m.userService.DeleteUser(c.Request.Context(), uuid)
	if err != nil {
		if err.Error() == "user not found" {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "User not found",
			})
			return
		}
		if err.Error() == "founder users cannot be deleted" {
			c.JSON(http.StatusForbidden, gin.H{
				"error": "Founder users cannot be deleted",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to delete user",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "User deleted successfully",
	})
}

// requestPasswordReset generates a password reset token for a user
func (m *Module) requestPasswordReset(c *gin.Context) {
	uuid := c.Param("uuid")
	if uuid == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "UUID is required",
		})
		return
	}

	// Get user by UUID to get their email
	user, err := m.userService.GetUserByUUID(c.Request.Context(), uuid)
	if err != nil {
		if err.Error() == "user not found" {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "User not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to retrieve user",
		})
		return
	}

	token, err := m.authService.GeneratePasswordResetToken(c.Request.Context(), user.Email)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	resp := models.PasswordResetTokenResponse{
		Token:     token.Token,
		Email:     token.Email,
		ExpiresAt: token.ExpiresAt,
		CreatedAt: token.CreatedAt,
	}

	c.JSON(http.StatusCreated, resp)
}
