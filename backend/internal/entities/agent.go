package entities

import "github.com/google/uuid"

const (
	AgentStatusActive   = "ACTIVE"
	AgentStatusErrored  = "ERRORED"
	AgentStatusInactive = "INACTIVE"
)

type Agent struct {
	UUID     uuid.UUID
	Name     string
	Token    string
	Address  string
	Status   string
	Error    string
	Icon     string // Optional icon for frontend display
	Color    string // Optional color for frontend display
	Instance *Instance
}
