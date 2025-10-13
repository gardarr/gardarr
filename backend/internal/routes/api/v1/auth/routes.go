package auth

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/gardarr/gardarr/internal/entities"
	"github.com/gardarr/gardarr/internal/infra/database"
	"github.com/gardarr/gardarr/internal/middlewares"
	"github.com/gardarr/gardarr/internal/models"
	"github.com/gardarr/gardarr/internal/schemas"
	"github.com/gardarr/gardarr/internal/services/ratelimit"
	"github.com/gardarr/gardarr/internal/services/session"
	"github.com/gardarr/gardarr/internal/services/user"
	"github.com/gin-gonic/gin"
)

const (
	sessionCookieName = "session_token"
	sessionMaxAge     = 7 * 24 * 60 * 60 // 7 days in seconds
)

type Module struct {
	group          *gin.RouterGroup
	userService    *user.Service
	sessionService *session.Service
	rateLimiter    *ratelimit.Service
	db             *database.Database
}

func NewModule(router *gin.RouterGroup, db *database.Database) *Module {
	return &Module{
		group:          router.Group("/auth"),
		userService:    user.NewService(db),
		sessionService: session.NewService(db),
		rateLimiter:    ratelimit.NewDefaultService(),
		db:             db,
	}
}

func (m *Module) Register() {
	// Public routes
	m.group.POST("/register", m.register)
	m.group.POST("/login", m.login)

	// Protected routes
	protected := m.group.Group("")
	protected.Use(middlewares.SessionMiddleware(m.db))
	protected.GET("/me", m.getCurrentUser)
	protected.POST("/logout", m.logout)
	protected.POST("/logout-all", m.logoutAll)
	protected.GET("/sessions", m.listSessions)
}

// register handles user registration
func (m *Module) register(c *gin.Context) {
	var body schemas.UserRegisterRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Validation failed",
			"details": err.Error(),
		})
		return
	}

	newUser, err := m.userService.CreateUser(c.Request.Context(), body.Email, body.Password)
	if err != nil {
		statusCode := http.StatusInternalServerError
		if strings.Contains(err.Error(), "already exists") {
			statusCode = http.StatusConflict
		} else if strings.Contains(err.Error(), "required") || strings.Contains(err.Error(), "at least") {
			statusCode = http.StatusBadRequest
		}

		c.JSON(statusCode, gin.H{"error": err.Error()})
		return
	}

	// Create session
	userAgent := c.Request.UserAgent()
	ipAddress := c.ClientIP()
	sessionEntity, err := m.sessionService.CreateSession(c.Request.Context(), newUser.UUID, userAgent, ipAddress)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create session"})
		return
	}

	// Set secure cookie
	m.setSessionCookie(c, sessionEntity.Token, sessionEntity.ExpiresAt.Unix())

	c.JSON(http.StatusCreated, models.AuthResponse{
		User: models.UserResponse{
			UUID:      newUser.UUID.String(),
			Email:     newUser.Email,
			CreatedAt: newUser.CreatedAt,
		},
	})
}

// login handles user authentication with rate limiting
func (m *Module) login(c *gin.Context) {
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
	sessionEntity, err := m.sessionService.CreateSession(c.Request.Context(), authenticatedUser.UUID, userAgent, ip)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create session"})
		return
	}

	// Set secure cookie
	m.setSessionCookie(c, sessionEntity.Token, sessionEntity.ExpiresAt.Unix())

	c.JSON(http.StatusOK, models.AuthResponse{
		User: models.UserResponse{
			UUID:      authenticatedUser.UUID.String(),
			Email:     authenticatedUser.Email,
			CreatedAt: authenticatedUser.CreatedAt,
		},
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
	c.JSON(http.StatusOK, models.UserResponse{
		UUID:      currentUser.UUID.String(),
		Email:     currentUser.Email,
		CreatedAt: currentUser.CreatedAt,
	})
}

// logout invalidates the current session
func (m *Module) logout(c *gin.Context) {
	token, err := c.Cookie(sessionCookieName)
	if err == nil && token != "" {
		_ = m.sessionService.DeleteSession(c.Request.Context(), token)
	}

	// Clear cookie
	c.SetCookie(sessionCookieName, "", -1, "/", "", false, true)
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
	if err := m.sessionService.DeleteUserSessions(c.Request.Context(), currentUser.UUID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to logout from all devices"})
		return
	}

	// Clear cookie
	c.SetCookie(sessionCookieName, "", -1, "/", "", false, true)
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
	// In production, set Secure to true when using HTTPS
	c.SetCookie(
		sessionCookieName,
		token,
		maxAge,
		"/",
		"",    // domain
		false, // secure - set to true in production with HTTPS
		true,  // httpOnly
	)
}
