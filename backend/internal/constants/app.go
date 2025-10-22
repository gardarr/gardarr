package constants

import "github.com/google/uuid"

const (
	AppDomainsEnv          = "APP_DOMAINS"
	AppPortEnv             = "APP_PORT"
	AgentPortEnv           = "AGENT_PORT"
	AgentSecretEnv         = "AGENT_SECRET"
	AppModeEnv             = "APP_MODE"
	StandaloneAgentAddress = "http://127.0.0.1:3100"
	StandaloneMode         = "standalone"
)

var (
	StandaloneAgentUUID = uuid.MustParse("00000000-0000-0000-0000-000000000000")
)
