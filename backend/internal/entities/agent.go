package entities

import "github.com/google/uuid"

const (
	AgentStatusActive       = "ACTIVE"
	AgentStatusErrored      = "ERRORED"
	AgentStatusInactive     = "INACTIVE"
	AgentStatusInitializing = "INITIALIZING"
	AgentStatusPending      = "PENDING"
)

// AgentErrorCode represents a specific error type for client-side handling
type AgentErrorCode string

const (
	// ErrorCodeNone indicates no error
	AgentErrorCodeNone AgentErrorCode = ""

	// AgentErrorCodeAuthFailure indicates invalid username/password
	AgentErrorCodeAuthFailure AgentErrorCode = "AUTH_FAILURE"

	// AgentErrorCodeTimeout indicates connection or request timeout
	AgentErrorCodeTimeout AgentErrorCode = "TIMEOUT"

	// AgentErrorCodeDNS indicates DNS resolution failure
	AgentErrorCodeDNS AgentErrorCode = "DNS_ERROR"

	// AgentErrorCodeHTTPSRequired indicates HTTP was used but HTTPS is required
	AgentErrorCodeHTTPSRequired AgentErrorCode = "HTTPS_REQUIRED"

	// AgentErrorCodeSSLError indicates SSL/TLS certificate or connection error
	AgentErrorCodeSSLError AgentErrorCode = "SSL_ERROR"

	// AgentErrorCodeVersionIncompatible indicates incompatible qBittorrent version
	AgentErrorCodeVersionIncompatible AgentErrorCode = "VERSION_INCOMPATIBLE"

	// AgentErrorCodeConnectionRefused indicates the server actively refused the connection
	AgentErrorCodeConnectionRefused AgentErrorCode = "CONNECTION_REFUSED"

	// AgentErrorCodeNetworkUnreachable indicates network routing issues
	AgentErrorCodeNetworkUnreachable AgentErrorCode = "NETWORK_UNREACHABLE"

	// AgentErrorCodeAgentUnreachable indicates the Gardarr agent is unreachable
	AgentErrorCodeAgentUnreachable AgentErrorCode = "AGENT_UNREACHABLE"

	// AgentErrorCodeBadGateway indicates a proxy/gateway error (502)
	AgentErrorCodeBadGateway AgentErrorCode = "BAD_GATEWAY"

	// AgentErrorCodeServiceUnavailable indicates the service is temporarily unavailable (503)
	AgentErrorCodeServiceUnavailable AgentErrorCode = "SERVICE_UNAVAILABLE"

	// AgentErrorCodeUnknown indicates an unclassified error
	AgentErrorCodeUnknown AgentErrorCode = "UNKNOWN"
)

type Agent struct {
	UUID       uuid.UUID
	Name       string
	Token      string
	Address    string
	Status     string
	Error      string
	ErrorCode  AgentErrorCode // Specific error code for frontend handling
	Permanent  bool           // True if error requires user intervention
	Icon       string         // Optional icon for frontend display
	Color      string         // Optional color for frontend display
	Standalone bool
	Instance   *Instance
}

type AgentVersion struct {
	Version string
	Commit  string
	Date    string
}
