package agentcheck

import (
	"fmt"

	"github.com/jfxdev/gardarr/internal/entities"
	"github.com/jfxdev/gardarr/internal/models"
)

// Result represents the outcome of a liveness response validation.
type Result struct {
	Healthy   bool
	ErrorCode entities.AgentErrorCode
	Message   string
	Permanent bool
}

// ValidateLiveness interprets an AgentLivenessResponse and returns a
// structured Result.  The same logic is shared by the standalone
// startup probe and the non-standalone CheckAgentAvailability path.
func ValidateLiveness(resp *models.AgentLivenessResponse) *Result {
	switch resp.Status {
	case entities.ConnectionStatusConnected:
		return &Result{Healthy: true}

	case entities.ConnectionStatusUnauthorized:
		message := resp.Message
		if message == "" {
			message = "Invalid qBittorrent username or password"
		}
		return &Result{
			ErrorCode: entities.AgentErrorCodeAuthFailure,
			Message:   message,
			Permanent: resp.Permanent,
		}

	case entities.ConnectionStatusUnaccessible:
		code := entities.AgentErrorCodeConnectionRefused
		if resp.ErrorCode != "" {
			candidate := entities.AgentErrorCode(resp.ErrorCode)
			if IsValidErrorCode(candidate) {
				code = candidate
			}
		}
		return &Result{
			ErrorCode: code,
			Message:   resp.Message,
			Permanent: resp.Permanent,
		}

	case entities.ConnectionStatusInitializing:
		return &Result{
			ErrorCode: entities.AgentErrorCodeServiceUnavailable,
			Message:   "qBittorrent is starting up",
		}

	default:
		return &Result{
			ErrorCode: entities.AgentErrorCodeUnknown,
			Message:   fmt.Sprintf("unknown agent status: %s", resp.Status),
		}
	}
}

// IsValidErrorCode reports whether code is one of the known
// AgentErrorCode constants defined in the entities package.
func IsValidErrorCode(code entities.AgentErrorCode) bool {
	switch code {
	case entities.AgentErrorCodeNone,
		entities.AgentErrorCodeAuthFailure,
		entities.AgentErrorCodeTimeout,
		entities.AgentErrorCodeDNS,
		entities.AgentErrorCodeHTTPSRequired,
		entities.AgentErrorCodeSSLError,
		entities.AgentErrorCodeVersionIncompatible,
		entities.AgentErrorCodeConnectionRefused,
		entities.AgentErrorCodeNetworkUnreachable,
		entities.AgentErrorCodeAgentUnreachable,
		entities.AgentErrorCodeBadGateway,
		entities.AgentErrorCodeServiceUnavailable,
		entities.AgentErrorCodeUnknown:
		return true
	default:
		return false
	}
}
