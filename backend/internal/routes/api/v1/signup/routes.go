package signup

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jfxdev/gardarr/internal/infra/database"
	"github.com/jfxdev/gardarr/internal/mappers"
	"github.com/jfxdev/gardarr/internal/middlewares"
	"github.com/jfxdev/gardarr/internal/models"
	"github.com/jfxdev/gardarr/internal/services/auth"
)

// Module holds signup routes configuration
type Module struct {
	group       *gin.RouterGroup
	authService *auth.Service
	db          *database.Database
}

// NewModule creates a new signup module
func NewModule(router *gin.RouterGroup, db *database.Database) *Module {
	return &Module{
		group:       router.Group("/signup"),
		authService: auth.NewService(db),
		db:          db,
	}
}

// Register registers all signup routes
func (m *Module) Register() {
	// Admin-only routes - require admin role (for managing magic links)
	admin := m.group.Group("")
	admin.Use(middlewares.SessionMiddleware(m.db))
	admin.Use(middlewares.RequireAdminRole())
	admin.POST("/magic_link", m.createMagicLink)
	admin.GET("/magic_link", m.listMagicLinks)
	admin.DELETE("/magic_link/:token", m.revokeMagicLink)

	// Public routes - no authentication required
	m.group.POST("/verify", m.verifySignup)
}

// createMagicLink generates a magic link token for user signup
func (m *Module) createMagicLink(c *gin.Context) {
	var req models.CreateSignupTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request body",
		})
		return
	}

	token, err := m.authService.GenerateSignupToken(c.Request.Context(), req.Role, req.ExpiresIn, req.Email)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	resp := models.SignupTokenResponse{
		Token:     token.Token,
		Email:     token.Email,
		Role:      token.Role,
		ExpiresAt: token.ExpiresAt,
		CreatedAt: token.CreatedAt,
	}

	c.JSON(http.StatusCreated, resp)
}

// verifySignup validates a magic link token and creates a new user
func (m *Module) verifySignup(c *gin.Context) {
	var req models.VerifySignupTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request body",
		})
		return
	}

	user, err := m.authService.ValidateAndUseSignupToken(c.Request.Context(), req.Token, req.Email, req.Password)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, models.AuthResponse{
		User: mappers.ToUserResponse(user),
	})
}

// listMagicLinks lists all signup tokens
func (m *Module) listMagicLinks(c *gin.Context) {
	tokens, err := m.authService.ListSignupTokens(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to retrieve magic links",
		})
		return
	}

	tokenItems := make([]models.SignupTokenListItem, len(tokens))
	for i, t := range tokens {
		tokenItems[i] = models.SignupTokenListItem{
			Token:     t.Token,
			Email:     t.Email,
			Role:      t.Role,
			ExpiresAt: t.ExpiresAt,
			UsedAt:    t.UsedAt,
			Used:      t.IsUsed(),
			CreatedAt: t.CreatedAt,
		}
	}

	resp := models.ListSignupTokensResponse{
		Tokens: tokenItems,
		Total:  len(tokenItems),
	}

	c.JSON(http.StatusOK, resp)
}

// revokeMagicLink revokes a magic link token
func (m *Module) revokeMagicLink(c *gin.Context) {
	token := c.Param("token")
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Token is required",
		})
		return
	}

	err := m.authService.RevokeSignupToken(c.Request.Context(), token)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Token revoked successfully",
	})
}
