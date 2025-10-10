package middlewares

import (
	"net/http"
	"strings"

	"github.com/gardarr/gardarr/internal/constants"
	"github.com/gardarr/gardarr/pkg/env"
	"github.com/gin-gonic/gin"
)

// RequireBearerToken validates the Authorization Bearer token against the value of the provided envKey.
// Returns 403 when the token is missing or does not match the expected value.
func RequireAgentBearerToken() gin.HandlerFunc {
	return func(c *gin.Context) {
		expected := strings.TrimSpace(env.Get(constants.AgentSecretEnv).Value())
		authHeader := c.GetHeader("Authorization")

		if expected == "" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		if !strings.HasPrefix(authHeader, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		provided := strings.TrimSpace(strings.TrimPrefix(authHeader, "Bearer "))
		if provided != expected {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		c.Next()
	}
}
