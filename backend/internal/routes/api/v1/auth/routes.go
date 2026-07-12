package auth

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jfxdev/gardarr/internal/entities"
	"github.com/jfxdev/gardarr/internal/infra/database"
	"github.com/jfxdev/gardarr/internal/mappers"
	"github.com/jfxdev/gardarr/internal/middlewares"
	"github.com/jfxdev/gardarr/internal/models"
	"github.com/jfxdev/gardarr/internal/schemas"
	"github.com/jfxdev/gardarr/internal/services/auth"
	"github.com/jfxdev/gardarr/internal/services/ratelimit"
	"github.com/jfxdev/gardarr/internal/services/session"
	"github.com/jfxdev/gardarr/internal/services/user"
	websocketSvc "github.com/jfxdev/gardarr/internal/services/websocket"
)

const (
	sessionCookieName = "session_token"
	sessionMaxAge     = 7 * 24 * 60 * 60 // 7 days in seconds
)

type Module struct {
	group          *gin.RouterGroup
	userService    *user.Service
	sessionService *session.Service
	authService    *auth.Service
	rateLimiter    *ratelimit.Service
	db             *database.Database
	wsHub          *websocketSvc.Hub
}

func NewModule(router *gin.RouterGroup, db *database.Database, wsHub *websocketSvc.Hub) *Module {
	return &Module{
		group:          router.Group("/auth"),
		userService:    user.NewService(db),
		sessionService: session.NewService(db),
		authService:    auth.NewService(db),
		rateLimiter:    ratelimit.NewDefaultService(),
		db:             db,
		wsHub:          wsHub,
	}
}

func (m *Module) Register() {
	// Public routes
	m.group.POST("/login", m.login)

	// Password reset routes - public (no authentication required)
	m.group.POST("/reset_password", m.resetPassword)

	// Protected routes
	protected := m.group.Group("")
	protected.Use(middlewares.SessionMiddleware(m.db))
	protected.GET("/me", m.getCurrentUser)
	protected.POST("/logout", m.logout)
	protected.POST("/logout-all", m.logoutAll)
	protected.GET("/sessions", m.listSessions)

	// Admin routes - require admin role
	admin := m.group.Group("")
	admin.Use(middlewares.SessionMiddleware(m.db))
	admin.Use(middlewares.RequireAdminRole())
}

// login handles user authentication with rate limiting
func (m *Module) login(c *gin.Context) {
	// Check if system is initialized (at least one user exists)
	count, err := m.userService.CountUsers(c.Request.Context())
	if err == nil && count == 0 {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error":        "System not initialized",
			"needs_setup":  true,
			"redirect_url": "/setup",
		})
		return
	}

	// Create identifier for rate limiting
	ip := c.ClientIP()
	userAgent := c.Request.UserAgent()
	identifier := ratelimit.GetIdentifier(ip, userAgent)

	// Check if blocked
	if blocked, remaining := m.rateLimiter.IsBlocked(identifier); blocked {
		c.JSON(http.StatusTooManyRequests, gin.H{
			"error":               "Too many login attempts",
			"retry_after_seconds": int(remaining.Seconds()),
		})
		return
	}

	var body schemas.UserLoginRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Validation failed",
			"details": err.Error(),
		})
		return
	}

	authenticatedUser, err := m.userService.VerifyPassword(c.Request.Context(), body.Email, body.Password)
	if err != nil {
		// Record failed attempt
		m.rateLimiter.RecordAttempt(identifier)

		// Log suspicious activity
		attemptCount := m.rateLimiter.GetAttemptCount(identifier)
		if attemptCount > 3 {
			fmt.Printf("[SECURITY] Multiple failed login attempts for %s from %s (count: %d)\n", body.Email, ip, attemptCount)
		}

		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	// Successful login - reset rate limit
	m.rateLimiter.Reset(identifier)

	// Create session
	sessionEntity, err := m.sessionService.CreateSession(c.Request.Context(), authenticatedUser.UUID, authenticatedUser.Role, userAgent, ip)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create session"})
		return
	}

	// Set secure cookie
	m.setSessionCookie(c, sessionEntity.Token, sessionEntity.ExpiresAt.Unix())

	c.JSON(http.StatusOK, models.AuthResponse{
		User: mappers.ToUserResponse(authenticatedUser),
	})
}

// getCurrentUser returns the current authenticated user
func (m *Module) getCurrentUser(c *gin.Context) {
	user, exists := c.Get(middlewares.UserContextKey)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	currentUser := user.(*entities.User)
	c.JSON(http.StatusOK, models.AuthResponse{
		User: mappers.ToUserResponse(currentUser),
	})
}

// logout invalidates the current session
func (m *Module) logout(c *gin.Context) {
	token, err := c.Cookie(sessionCookieName)
	if err == nil && token != "" {
		_ = m.sessionService.DeleteSession(c.Request.Context(), token)
		if m.wsHub != nil {
			m.wsHub.DropSession(token)
		}
	}

	// Clear cookie
	c.SetCookie(sessionCookieName, "", -1, "/", "", middlewares.IsSecureCookie(), true)
	c.JSON(http.StatusOK, gin.H{"message": "Logged out successfully"})
}

// logoutAll invalidates all sessions for the current user (logout from all devices)
func (m *Module) logoutAll(c *gin.Context) {
	user, exists := c.Get(middlewares.UserContextKey)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	currentUser := user.(*entities.User)

	// Fetch sessions before deleting so we still have their tokens to drop
	// the corresponding WS connections afterward.
	sessions, _ := m.sessionService.GetUserSessions(c.Request.Context(), currentUser.UUID)

	if err := m.sessionService.DeleteUserSessions(c.Request.Context(), currentUser.UUID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to logout from all devices"})
		return
	}

	if m.wsHub != nil {
		for _, s := range sessions {
			m.wsHub.DropSession(s.Token)
		}
	}

	// Clear cookie
	c.SetCookie(sessionCookieName, "", -1, "/", "", middlewares.IsSecureCookie(), true)
	c.JSON(http.StatusOK, gin.H{"message": "Logged out from all devices"})
}

// listSessions returns all active sessions for the current user
func (m *Module) listSessions(c *gin.Context) {
	user, exists := c.Get(middlewares.UserContextKey)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	currentUser := user.(*entities.User)
	sessions, err := m.sessionService.GetUserSessions(c.Request.Context(), currentUser.UUID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve sessions"})
		return
	}

	response := make([]models.SessionResponse, len(sessions))
	for i, s := range sessions {
		response[i] = models.SessionResponse{
			ID:        s.ID.String(),
			UserAgent: s.UserAgent,
			IPAddress: s.IPAddress,
			CreatedAt: s.CreatedAt,
			ExpiresAt: s.ExpiresAt,
		}
	}

	c.JSON(http.StatusOK, response)
}

// setSessionCookie sets a secure HTTP-only cookie with the session token
func (m *Module) setSessionCookie(c *gin.Context, token string, expiresAt int64) {
	// Use session max age
	maxAge := sessionMaxAge

	// Set secure cookie
	// Secure attribute is automatically set based on APP_URL scheme (https = secure)
	c.SetCookie(
		sessionCookieName,
		token,
		maxAge,
		"/",
		"",                           // domain
		middlewares.IsSecureCookie(), // secure - true when APP_URL uses HTTPS
		true,                         // httpOnly
	)
}

// resetPassword validates a password reset token and updates the user's password
func (m *Module) resetPassword(c *gin.Context) {
	var req models.ResetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request body",
		})
		return
	}

	err := m.authService.ValidateAndResetPassword(c.Request.Context(), req.Token, req.NewPassword)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Password reset successfully",
	})
}
