package agent

import (
	"context"

	"github.com/gardarr/gardarr/internal/entities"
	"github.com/gardarr/gardarr/internal/schemas"
	"github.com/google/uuid"
)

// RepositoryInterface defines the interface for agent repository operations
type RepositoryInterface interface {
	CreateAgent(ctx context.Context, agent entities.Agent) (*entities.Agent, error)
	ListAgents() ([]*entities.Agent, error)
	GetAgentByUUID(uid uuid.UUID) (*entities.Agent, error)
	UpdateAgent(ctx context.Context, uid uuid.UUID, updates map[string]interface{}) (*entities.Agent, error)
	DeleteAgent(uid uuid.UUID) error
	GetInstance(agent *entities.Agent) (*entities.Instance, error)
	GetInstanceWithoutDecrypt(agent *entities.Agent) (*entities.Instance, error)
	GetAgentPreferences(agent *entities.Agent) (*entities.InstancePreferences, error)
	ListAgentTasks(agent *entities.Agent) ([]*entities.Task, error)
	CreateAgentTask(agent *entities.Agent, schema schemas.TaskCreateSchema) (*entities.Task, error)
	StopAgentTask(agent *entities.Agent, taskID string) error
	StartAgentTask(agent *entities.Agent, taskID string) error
	ForceDownloadAgentTask(agent *entities.Agent, taskID string) error
	GetAgentTask(agent *entities.Agent, taskID string) (*entities.Task, error)
	DeleteAgentTask(agent *entities.Agent, taskID string, purge bool) error
	ForceResumeAgentTask(agent *entities.Agent, taskID string) error
	SetAgentTaskShareLimit(agent *entities.Agent, taskID string, schema schemas.TaskSetShareLimitSchema) error
	SetAgentTaskLocation(agent *entities.Agent, taskID string, schema schemas.TaskSetLocationSchema) error
	RenameAgentTask(agent *entities.Agent, taskID string, schema schemas.TaskRenameSchema) error
	SetAgentTaskSuperSeeding(agent *entities.Agent, taskID string, schema schemas.TaskSuperSeedingSchema) error
	ForceRecheckAgentTask(agent *entities.Agent, taskID string) error
	ForceReannounceAgentTask(agent *entities.Agent, taskID string) error
	SetAgentTaskDownloadLimit(agent *entities.Agent, taskID string, schema schemas.TaskSetDownloadLimitSchema) error
	SetAgentTaskUploadLimit(agent *entities.Agent, taskID string, schema schemas.TaskSetUploadLimitSchema) error
	ListAgentTaskFiles(agent *entities.Agent, taskID string) ([]*entities.TaskFile, error)
	GetAgentTasksStats(agent *entities.Agent) (*entities.TaskStats, error)
	GetAgentVersion(agent *entities.Agent) (*entities.AgentVersion, error)
}
