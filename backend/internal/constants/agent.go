package constants

import "github.com/google/uuid"

const (
	AgentPortEnv               = "AGENT_PORT"
	AgentSecretEnv             = "AGENT_SECRET"
	StandaloneAgentAddress     = "http://127.0.0.1:3100"
	AgentTimeoutSecondsEnv     = "AGENT_TIMEOUT_SECONDS"
	DefaultAgentTimeoutSeconds = 3
)

const (
	AgentStatusActive   = "ACTIVE"
	AgentStatusErrored  = "ERRORED"
	AgentStatusInactive = "INACTIVE"
)

var (
	StandaloneAgentUUID = uuid.MustParse("00000000-0000-0000-0000-000000000000")
)
