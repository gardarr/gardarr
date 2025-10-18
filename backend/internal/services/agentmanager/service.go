package agentmanager

import (
	"context"
	"fmt"
	"strings"

	"github.com/gardarr/gardarr/internal/entities"
	"github.com/gardarr/gardarr/internal/infra/database"
	"github.com/gardarr/gardarr/internal/models"
	"github.com/gardarr/gardarr/internal/repository/agent"
	"github.com/gardarr/gardarr/internal/schemas"
	"github.com/gardarr/gardarr/internal/services/crypto"
	"github.com/google/uuid"
)

type Service struct {
	repository *agent.Repository
}

func NewService(db *database.Database, c *crypto.CryptoService) *Service {
	return &Service{
		repository: agent.NewRepository(db, c),
	}
}

func (s *Service) CreateAgent(ctx context.Context, schema *schemas.AgentCreateSchema) (*entities.Agent, error) {
	input := entities.Agent{
		Name:    schema.Name,
		Address: schema.Address,
		Token:   schema.Token,
		Icon:    schema.Icon,
		Color:   schema.Color,
	}

	// Validate instance connectivity BEFORE persisting to database
	instance, err := s.repository.GetInstance(&input)
	if err != nil {
		return nil, fmt.Errorf("não foi possível conectar com a instância: %s", err.Error())
	}

	// If connection is successful, create the agent
	agent, err := s.repository.CreateAgent(ctx, input)
	if err != nil {
		return nil, err
	}

	// Set status and instance data
	agent.Status = entities.AgentStatusActive
	agent.Instance = instance

	return agent, nil
}

func (s *Service) ListAgents() ([]*entities.Agent, error) {
	agents, err := s.repository.ListAgents()
	if err != nil {
		return nil, err
	}

	// Create a channel to receive processed agents
	agentChan := make(chan *entities.Agent, len(agents))

	// Process each agent concurrently
	for _, agent := range agents {
		go func(a *entities.Agent) {
			// Set default status to ACTIVE
			a.Status = entities.AgentStatusActive

			// Try to get instance, if it fails, set status to ERRORED
			instance, err := s.repository.GetInstance(a)
			if err != nil {
				a.Status = entities.AgentStatusErrored
				a.Error = err.Error()
				a.Instance = nil
			} else {
				a.Instance = instance
			}

			// Send the processed agent to the channel
			agentChan <- a
		}(agent)
	}

	// Collect all processed agents from the channel
	result := make([]*entities.Agent, 0, len(agents))
	for i := 0; i < len(agents); i++ {
		processedAgent := <-agentChan
		result = append(result, processedAgent)
	}

	// Close the channel
	close(agentChan)

	return result, nil
}

func (s *Service) ListTasks(agents []*entities.Agent) ([]*entities.Task, error) {
	if len(agents) == 0 {
		return []*entities.Task{}, nil
	}

	// Create channels to receive results and errors
	taskChan := make(chan []*entities.Task, len(agents))
	errorChan := make(chan error, len(agents))

	// Process each agent concurrently
	for _, agent := range agents {
		go func(a *entities.Agent) {
			tasks, err := s.repository.ListAgentTasks(a)
			if err != nil {
				errorChan <- err
				taskChan <- nil
			} else {
				errorChan <- nil
				taskChan <- tasks
			}
		}(agent)
	}

	// Collect results and errors
	var result []*entities.Task
	var errors []error

	for i := 0; i < len(agents); i++ {
		tasks := <-taskChan
		err := <-errorChan

		if err != nil {
			errors = append(errors, err)
		} else if tasks != nil {
			result = append(result, tasks...)
		}
	}

	// Close channels
	close(taskChan)
	close(errorChan)

	// If we have any errors, return them along with the results
	if len(errors) > 0 {
		// Create a combined error message
		var errorMsg strings.Builder
		errorMsg.WriteString("errors occurred while fetching tasks from agents: ")
		for i, err := range errors {
			if i > 0 {
				errorMsg.WriteString("; ")
			}
			errorMsg.WriteString(err.Error())
		}
		return result, fmt.Errorf("%s", errorMsg.String())
	}

	return result, nil
}

func (s *Service) Get(ctx context.Context, id string) (*entities.Agent, error) {
	parsedID, err := uuid.Parse(id)
	if err != nil {
		return nil, fmt.Errorf("invalid UUID format: %w", err)
	}

	agent, err := s.repository.GetAgentByUUID(parsedID)
	if err != nil {
		return nil, fmt.Errorf("agent not found: %w", err)
	}

	// Set default status to ACTIVE
	agent.Status = entities.AgentStatusActive

	// Try to get instance, if it fails, set status to ERRORED
	instance, err := s.repository.GetInstance(agent)
	if err != nil {
		agent.Status = entities.AgentStatusErrored
		agent.Instance = nil
	} else {
		agent.Instance = instance
	}

	return agent, nil
}

func (s *Service) GetAgent(ctx context.Context, id string) (*entities.Agent, error) {
	parsedID, err := uuid.Parse(id)
	if err != nil {
		return nil, err
	}

	agent, err := s.repository.GetAgentByUUID(parsedID)
	if err != nil {
		return nil, err
	}

	// Set default status to ACTIVE
	agent.Status = entities.AgentStatusActive

	// Try to get instance, if it fails, set status to ERRORED
	instance, err := s.repository.GetInstance(agent)
	if err != nil {
		agent.Status = entities.AgentStatusErrored
		agent.Error = err.Error()
		agent.Instance = nil
	} else {
		agent.Instance = instance
	}

	return agent, nil
}

func (s *Service) UpdateAgent(ctx context.Context, id string, schema *schemas.AgentUpdateSchema) (*entities.Agent, error) {
	parsedID, err := uuid.Parse(id)
	if err != nil {
		return nil, fmt.Errorf("invalid UUID format: %w", err)
	}

	// Get the current agent first
	currentAgent, err := s.repository.GetAgentByUUID(parsedID)
	if err != nil {
		return nil, fmt.Errorf("agent not found: %w", err)
	}

	// Convert schema to map for updates
	updates := make(map[string]interface{})
	if schema.Name != "" {
		updates["name"] = schema.Name
	}
	if schema.Address != "" {
		updates["address"] = schema.Address
	}
	if schema.Token != "" {
		updates["token"] = schema.Token
	}
	if schema.Icon != "" {
		updates["icon"] = schema.Icon
	}
	if schema.Color != "" {
		updates["color"] = schema.Color
	}

	// Create a test agent with updated values to validate connectivity
	testAgent := *currentAgent
	if schema.Name != "" {
		testAgent.Name = schema.Name
	}
	if schema.Address != "" {
		testAgent.Address = schema.Address
	}
	if schema.Token != "" {
		testAgent.Token = schema.Token
	}
	if schema.Icon != "" {
		testAgent.Icon = schema.Icon
	}
	if schema.Color != "" {
		testAgent.Color = schema.Color
	}

	// Validate instance connectivity BEFORE updating the database
	instance, err := s.repository.GetInstance(&testAgent)
	if err != nil {
		return nil, fmt.Errorf("não foi possível conectar com a instância: %s", err.Error())
	}

	// If connection is successful, update the agent in the database
	agent, err := s.repository.UpdateAgent(ctx, parsedID, updates)
	if err != nil {
		return nil, fmt.Errorf("failed to update agent: %w", err)
	}

	// Set status and instance data
	agent.Status = entities.AgentStatusActive
	agent.Instance = instance

	return agent, nil
}

func (s *Service) Delete(ctx context.Context, id string) error {
	parsedID, err := uuid.Parse(id)
	if err != nil {
		return err
	}

	return s.repository.DeleteAgent(parsedID)
}

func (s *Service) CreateAgentTask(ctx context.Context, id string, schema schemas.TaskCreateSchema) (*entities.Task, error) {
	uid, err := uuid.Parse(id)
	if err != nil {
		return nil, fmt.Errorf("invalid UUID format: %w", err)
	}

	agent, err := s.repository.GetAgentByUUID(uid)
	if err != nil {
		return nil, fmt.Errorf("agent not found: %w", err)
	}

	task, err := s.repository.CreateAgentTask(agent, schema)
	if err != nil {
		return nil, fmt.Errorf("failed to create task: %w", err)
	}

	return task, nil
}

func (s *Service) GetPreferences(ctx context.Context, agent *entities.Agent) (*entities.InstancePreferences, error) {
	preferences, err := s.repository.GetAgentPreferences(agent)
	if err != nil {
		return nil, fmt.Errorf("failed to get preferences: %w", err)
	}

	return preferences, nil
}

func (s *Service) ListAgentTasks(ctx context.Context, id string) ([]*entities.Task, error) {
	uid, err := uuid.Parse(id)
	if err != nil {
		return nil, fmt.Errorf("invalid UUID format: %w", err)
	}

	agent, err := s.repository.GetAgentByUUID(uid)
	if err != nil {
		return nil, fmt.Errorf("agent not found: %w", err)
	}

	tasks, err := s.repository.ListAgentTasks(agent)
	if err != nil {
		return nil, fmt.Errorf("failed to list tasks: %w", err)
	}

	return tasks, nil
}

func (s *Service) ListAgentsTasks() ([]*entities.Task, error) {
	agents, err := s.repository.ListAgents()
	if err != nil {
		return nil, fmt.Errorf("failed to list agents: %w", err)
	}

	return s.ListTasks(agents)
}

func (s *Service) PauseAgentTask(ctx context.Context, agentID, taskID string) error {
	uid, err := uuid.Parse(agentID)
	if err != nil {
		return fmt.Errorf("invalid agent UUID format: %w", err)
	}

	agent, err := s.repository.GetAgentByUUID(uid)
	if err != nil {
		return fmt.Errorf("agent not found: %w", err)
	}

	return s.repository.PauseAgentTask(agent, taskID)
}

func (s *Service) ResumeAgentTask(ctx context.Context, agentID, taskID string) error {
	uid, err := uuid.Parse(agentID)
	if err != nil {
		return fmt.Errorf("invalid agent UUID format: %w", err)
	}

	agent, err := s.repository.GetAgentByUUID(uid)
	if err != nil {
		return fmt.Errorf("agent not found: %w", err)
	}

	return s.repository.ResumeAgentTask(agent, taskID)
}

func (s *Service) ForceDownloadAgentTask(ctx context.Context, agentID, taskID string) error {
	uid, err := uuid.Parse(agentID)
	if err != nil {
		return fmt.Errorf("invalid agent UUID format: %w", err)
	}

	agent, err := s.repository.GetAgentByUUID(uid)
	if err != nil {
		return fmt.Errorf("agent not found: %w", err)
	}

	return s.repository.ForceDownloadAgentTask(agent, taskID)
}

func ToResponse(item *entities.Agent) models.AgentResponse {
	return models.AgentResponse{
		UUID:    item.UUID.String(),
		Name:    item.Name,
		Address: item.Address,
		Status:  item.Status,
	}
}
