package workercheck

import (
	"fmt"

	"github.com/jfxdev/gardarr/internal/entities"
	"github.com/jfxdev/gardarr/internal/models"
)

// Result represents the outcome of a liveness response validation.
type Result struct {
	Healthy   bool
	ErrorCode entities.WorkerErrorCode
	Message   string
	Permanent bool
}

// ValidateLiveness interprets an WorkerLivenessResponse and returns a
// structured Result.  The same logic is shared by the standalone
// startup probe and the non-standalone CheckWorkerAvailability path.
func ValidateLiveness(resp *models.WorkerLivenessResponse) *Result {
	switch resp.Status {
	case entities.ConnectionStatusConnected:
		return &Result{Healthy: true}

	case entities.ConnectionStatusUnauthorized:
		message := resp.Message
		if message == "" {
			message = "Invalid qBittorrent username or password"
		}
		return &Result{
			ErrorCode: entities.WorkerErrorCodeAuthFailure,
			Message:   message,
			Permanent: resp.Permanent,
		}

	case entities.ConnectionStatusUnaccessible:
		code := entities.WorkerErrorCodeConnectionRefused
		if resp.ErrorCode != "" {
			candidate := entities.WorkerErrorCode(resp.ErrorCode)
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
			ErrorCode: entities.WorkerErrorCodeServiceUnavailable,
			Message:   "qBittorrent is starting up",
		}

	default:
		return &Result{
			ErrorCode: entities.WorkerErrorCodeUnknown,
			Message:   fmt.Sprintf("unknown worker status: %s", resp.Status),
		}
	}
}

// IsValidErrorCode reports whether code is one of the known
// WorkerErrorCode constants defined in the entities package.
func IsValidErrorCode(code entities.WorkerErrorCode) bool {
	switch code {
	case entities.WorkerErrorCodeNone,
		entities.WorkerErrorCodeAuthFailure,
		entities.WorkerErrorCodeTimeout,
		entities.WorkerErrorCodeDNS,
		entities.WorkerErrorCodeHTTPSRequired,
		entities.WorkerErrorCodeSSLError,
		entities.WorkerErrorCodeVersionIncompatible,
		entities.WorkerErrorCodeConnectionRefused,
		entities.WorkerErrorCodeNetworkUnreachable,
		entities.WorkerErrorCodeWorkerUnreachable,
		entities.WorkerErrorCodeBadGateway,
		entities.WorkerErrorCodeServiceUnavailable,
		entities.WorkerErrorCodeUnknown:
		return true
	default:
		return false
	}
}
