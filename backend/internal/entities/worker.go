package entities

import "github.com/google/uuid"

const (
	WorkerStatusActive       = "ACTIVE"
	WorkerStatusErrored      = "ERRORED"
	WorkerStatusInactive     = "INACTIVE"
	WorkerStatusInitializing = "INITIALIZING"
	WorkerStatusPending      = "PENDING"
)

// WorkerErrorCode represents a specific error type for client-side handling
type WorkerErrorCode string

const (
	// ErrorCodeNone indicates no error
	WorkerErrorCodeNone WorkerErrorCode = ""

	// WorkerErrorCodeAuthFailure indicates invalid username/password
	WorkerErrorCodeAuthFailure WorkerErrorCode = "AUTH_FAILURE"

	// WorkerErrorCodeTimeout indicates connection or request timeout
	WorkerErrorCodeTimeout WorkerErrorCode = "TIMEOUT"

	// WorkerErrorCodeDNS indicates DNS resolution failure
	WorkerErrorCodeDNS WorkerErrorCode = "DNS_ERROR"

	// WorkerErrorCodeHTTPSRequired indicates HTTP was used but HTTPS is required
	WorkerErrorCodeHTTPSRequired WorkerErrorCode = "HTTPS_REQUIRED"

	// WorkerErrorCodeSSLError indicates SSL/TLS certificate or connection error
	WorkerErrorCodeSSLError WorkerErrorCode = "SSL_ERROR"

	// WorkerErrorCodeVersionIncompatible indicates incompatible qBittorrent version
	WorkerErrorCodeVersionIncompatible WorkerErrorCode = "VERSION_INCOMPATIBLE"

	// WorkerErrorCodeConnectionRefused indicates the server actively refused the connection
	WorkerErrorCodeConnectionRefused WorkerErrorCode = "CONNECTION_REFUSED"

	// WorkerErrorCodeNetworkUnreachable indicates network routing issues
	WorkerErrorCodeNetworkUnreachable WorkerErrorCode = "NETWORK_UNREACHABLE"

	// WorkerErrorCodeWorkerUnreachable indicates the Gardarr worker is unreachable
	WorkerErrorCodeWorkerUnreachable WorkerErrorCode = "WORKER_UNREACHABLE"

	// WorkerErrorCodeBadGateway indicates a proxy/gateway error (502)
	WorkerErrorCodeBadGateway WorkerErrorCode = "BAD_GATEWAY"

	// WorkerErrorCodeServiceUnavailable indicates the service is temporarily unavailable (503)
	WorkerErrorCodeServiceUnavailable WorkerErrorCode = "SERVICE_UNAVAILABLE"

	// WorkerErrorCodeUnknown indicates an unclassified error
	WorkerErrorCodeUnknown WorkerErrorCode = "UNKNOWN"
)

type Worker struct {
	UUID       uuid.UUID
	Name       string
	Token      string
	Address    string
	Status     string
	Error      string
	ErrorCode  WorkerErrorCode // Specific error code for frontend handling
	Permanent  bool            // True if error requires user intervention
	Icon       string          // Optional icon for frontend display
	Color      string          // Optional color for frontend display
	Instance   *Instance
}

type WorkerVersion struct {
	Version        string
	Commit         string
	Date           string
	QbittorrentURL string
}
