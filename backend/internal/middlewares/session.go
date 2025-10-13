package middlewares

import (
	"fmt"
	"net/http"

	"github.com/gardarr/gardarr/internal/infra/database"
	"github.com/gardarr/gardarr/internal/services/ratelimit"
	"github.com/gardarr/gardarr/internal/services/session"
	"github.com/gin-gonic/gin"
)

const (
	SessionCookieName = "session_token"
	UserContextKey    = "user"
	SessionContextKey = "session"
)

var (
	// Global rate limiter instance
	rateLimiter = ratelimit.NewDefaultService()
)

// SessionMiddleware validates the session token from cookies with rate limiting
func SessionMiddleware(db *database.Database) gin.HandlerFunc {
	sessionService := session.NewService(db)

	return func(c *gin.Context) {
		// Create identifier for rate limiting
		ip := c.ClientIP()
		userAgent := c.Request.UserAgent()
		identifier := ratelimit.GetIdentifier(ip, userAgent)

		// Check if blocked
		if blocked, remaining := rateLimiter.IsBlocked(identifier); blocked {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":               "Too many failed authentication attempts",
				"retry_after_seconds": int(remaining.Seconds()),
			})
			c.Abort()
			return
		}

		// Get session token from cookie
		token, err := c.Cookie(SessionCookieName)
		if err != nil || token == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
			c.Abort()
			return
		}

		// Validate session
		user, sessionEntity, err := sessionService.ValidateSession(c.Request.Context(), token)
		if err != nil {
			// Record failed attempt
			rateLimiter.RecordAttempt(identifier)

			// Clear invalid cookie
			c.SetCookie(SessionCookieName, "", -1, "/", "", false, true)

			// Log suspicious activity
			attemptCount := rateLimiter.GetAttemptCount(identifier)
			if attemptCount > 3 {
				fmt.Printf("[SECURITY] Multiple failed auth attempts from %s (count: %d)\n", ip, attemptCount)
			}

			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired session"})
			c.Abort()
			return
		}

		// Successful authentication - reset rate limit
		rateLimiter.Reset(identifier)

		// Store user and session in context
		c.Set(UserContextKey, user)
		c.Set(SessionContextKey, sessionEntity)

		c.Next()
	}
}

// OptionalSessionMiddleware validates the session but doesn't abort if missing
func OptionalSessionMiddleware(db *database.Database) gin.HandlerFunc {
	sessionService := session.NewService(db)

	return func(c *gin.Context) {
		// Get session token from cookie
		token, err := c.Cookie(SessionCookieName)
		if err != nil || token == "" {
			c.Next()
			return
		}

		// Validate session
		user, sessionEntity, err := sessionService.ValidateSession(c.Request.Context(), token)
		if err != nil {
			// Clear invalid cookie
			c.SetCookie(SessionCookieName, "", -1, "/", "", false, true)
			c.Next()
			return
		}

		// Store user and session in context
		c.Set(UserContextKey, user)
		c.Set(SessionContextKey, sessionEntity)

		c.Next()
	}
}
