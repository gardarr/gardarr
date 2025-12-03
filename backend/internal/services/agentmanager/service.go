package agentmanager

import (
	"context"
	"fmt"
	"sort"

	"github.com/google/uuid"
	"github.com/jfxdev/gardarr/internal/entities"
	"github.com/jfxdev/gardarr/internal/infra/database"
	repository "github.com/jfxdev/gardarr/internal/repository/agent"
	"github.com/jfxdev/gardarr/internal/schemas"
	"github.com/jfxdev/gardarr/internal/services/crypto"
	metadata "github.com/jfxdev/gardarr/internal/services/task_metadata"
)

type Service struct {
	repository      repository.RepositoryInterface
	metadataService *metadata.Service
}

func NewService(db *database.Database, c *crypto.CryptoService, baseURL, uploadDir string) (*Service, error) {
	repository, err := repository.NewRepository(db, c)
	if err != nil {
		return nil, err
	}

	meta, err := metadata.NewService(db, baseURL, uploadDir)
	if err != nil {
		return nil, err
	}

	return &Service{
		repository:      repository,
		metadataService: meta,
	}, nil
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
	instance, err := s.repository.GetInstanceWithoutDecrypt(&input)
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
			a.Status = entities.AgentStatusActive

			// Try to get instance
			// GetInstance internally calls isAvailable first - if that fails, it aborts and returns error
			// If error occurs (including isAvailable failure), abort and return agent with error status
			instance, err := s.repository.GetInstance(a)
			if err != nil {
				// isAvailable failed or GetInstance failed - abort execution
				a.Status = entities.AgentStatusErrored
				a.Error = err.Error()
				a.Instance = nil
				agentChan <- a
				return
			}

			// Success - set instance
			a.Instance = instance

			// Send the processed agent to the channel
			agentChan <- a
		}(agent)
	}

	// Collect all processed agents from the channel
	result := make([]*entities.Agent, 0, len(agents))
	for range len(agents) {
		processedAgent := <-agentChan
		result = append(result, processedAgent)
	}

	// Close the channel
	close(agentChan)

	return result, nil
}

// enrichTasksWithMetadata loads metadata for a list of tasks
func (s *Service) enrichTasksWithMetadata(ctx context.Context, tasks []*entities.Task) error {
	if len(tasks) == 0 {
		return nil
	}

	// Collect all task hashes
	taskHashes := make([]string, 0, len(tasks))
	for _, task := range tasks {
		taskHashes = append(taskHashes, task.Hash)
	}

	// Load metadata in batch
	metadataMap, err := s.metadataService.GetByTaskHashes(ctx, taskHashes)
	if err != nil {
		// Log error but don't fail - metadata is optional
		return nil
	}

	// Attach metadata to tasks
	for _, task := range tasks {
		if metadata, exists := metadataMap[task.Hash]; exists {
			task.Metadata = metadata
		}
	}

	return nil
}

func (s *Service) ListTasks(ctx context.Context, agents []*entities.Agent) (*entities.TaskListResult, error) {
	if len(agents) == 0 {
		return &entities.TaskListResult{
			Tasks:  []*entities.Task{},
			Errors: make(map[string]string),
		}, nil
	}

	type agentResult struct {
		agentID string
		tasks   []*entities.Task
		err     error
	}

	// Create channel to receive results
	resultChan := make(chan agentResult, len(agents))

	// Process each agent concurrently
	for _, agent := range agents {
		go func(a *entities.Agent) {
			// Check context before starting work
			select {
			case <-ctx.Done():
				resultChan <- agentResult{
					agentID: a.UUID.String(),
					err:     ctx.Err(),
				}
				return
			default:
			}

			tasks, err := s.repository.ListAgentTasks(a)
			resultChan <- agentResult{
				agentID: a.UUID.String(),
				tasks:   tasks,
				err:     err,
			}
		}(agent)
	}

	// Collect results
	allTasks := make([]*entities.Task, 0)
	agentErrors := make(map[string]string)

	for i := 0; i < len(agents); i++ {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case res := <-resultChan:
			if res.err != nil {
				agentErrors[res.agentID] = res.err.Error()
			} else if res.tasks != nil {
				allTasks = append(allTasks, res.tasks...)
			}
		}
	}

	close(resultChan)

	// Enrich tasks with metadata
	_ = s.enrichTasksWithMetadata(ctx, allTasks)

	return &entities.TaskListResult{
		Tasks:  allTasks,
		Errors: agentErrors,
	}, nil
}

func (s *Service) GetAgent(ctx context.Context, id string) (*entities.Agent, error) {
	// Check if context is already cancelled
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}

	agent, err := s.getAgent(id)
	if err != nil {
		return nil, err
	}

	// Set default status to ACTIVE
	agent.Status = entities.AgentStatusActive

	// Check agent availability first - if it fails, abort immediately without trying to get instance
	if err := s.repository.CheckAgentAvailability(agent); err != nil {
		// Check if context was cancelled during the call
		select {
		case <-ctx.Done():
			agent.Status = entities.AgentStatusErrored
			agent.Instance = nil
			agent.Error = "request cancelled or timeout"
			return agent, nil
		default:
			// Agent is not available - abort execution and return agent with error status
			agent.Status = entities.AgentStatusErrored
			agent.Instance = nil
			agent.Error = err.Error()
			return agent, nil
		}
	}

	// Agent is available, now try to get instance
	// GetInstance internally calls isAvailable again as a safety check
	// If it fails, abort and return agent with error
	instance, err := s.repository.GetInstance(agent)
	if err != nil {
		// Check if context was cancelled during the call
		select {
		case <-ctx.Done():
			// Context was cancelled - abort execution
			agent.Status = entities.AgentStatusErrored
			agent.Instance = nil
			agent.Error = "request cancelled or timeout"
			return agent, nil
		default:
			// Error from GetInstance (could be from isAvailable or instance fetch)
			// Abort execution and return agent with error status and instance = nil
			agent.Status = entities.AgentStatusErrored
			agent.Instance = nil
			agent.Error = err.Error()
			return agent, nil
		}
	}

	// Success - set instance
	agent.Instance = instance

	return agent, nil
}

func (s *Service) UpdateAgent(ctx context.Context, id string, schema *schemas.AgentUpdateSchema) (*entities.Agent, error) {
	// Get the current agent first
	currentAgent, err := s.getAgent(id)
	if err != nil {
		return nil, err
	}
	parsedID := currentAgent.UUID

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

	var instance *entities.Instance
	// Validate instance connectivity BEFORE updating the database
	if testAgent.Token != currentAgent.Token {
		instance, err = s.repository.GetInstanceWithoutDecrypt(&testAgent)
		if err != nil {
			return nil, fmt.Errorf("não foi possível conectar com a instância: %s", err.Error())
		}
	} else {
		testAgent.Token = currentAgent.Token
		instance, err = s.repository.GetInstance(&testAgent)
		if err != nil {
			return nil, fmt.Errorf("não foi possível conectar com a instância: %s", err.Error())
		}
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
	agent, err := s.getAgent(id)
	if err != nil {
		return nil, err
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
	agent, err := s.getAgent(id)
	if err != nil {
		return nil, err
	}

	tasks, err := s.repository.ListAgentTasks(agent)
	if err != nil {
		return nil, fmt.Errorf("failed to list tasks: %w", err)
	}

	// Enrich tasks with metadata
	_ = s.enrichTasksWithMetadata(ctx, tasks)

	return tasks, nil
}

func (s *Service) ListAgentsTasks(ctx context.Context) (*entities.TaskListResult, error) {
	agents, err := s.repository.ListAgents()
	if err != nil {
		return nil, fmt.Errorf("failed to list agents: %w", err)
	}

	return s.ListTasks(ctx, agents)
}

func (s *Service) StopAgentTask(ctx context.Context, agentID, taskID string) error {
	agent, err := s.getAgent(agentID)
	if err != nil {
		return err
	}

	return s.repository.StopAgentTask(agent, taskID)
}

func (s *Service) StartAgentTask(ctx context.Context, agentID, taskID string) error {
	agent, err := s.getAgent(agentID)
	if err != nil {
		return err
	}

	return s.repository.StartAgentTask(agent, taskID)
}

func (s *Service) ForceDownloadAgentTask(ctx context.Context, agentID, taskID string) error {
	agent, err := s.getAgent(agentID)
	if err != nil {
		return err
	}

	return s.repository.ForceDownloadAgentTask(agent, taskID)
}

func (s *Service) GetAgentTask(ctx context.Context, agentID, taskID string) (*entities.Task, error) {
	agent, err := s.getAgent(agentID)
	if err != nil {
		return nil, err
	}

	task, err := s.repository.GetAgentTask(agent, taskID)
	if err != nil {
		return nil, fmt.Errorf("failed to get task: %w", err)
	}

	// Enrich task with metadata
	_ = s.enrichTasksWithMetadata(ctx, []*entities.Task{task})

	return task, nil
}

func (s *Service) DeleteAgentTask(ctx context.Context, agentID, taskID string, purge bool) error {
	agent, err := s.getAgent(agentID)
	if err != nil {
		return err
	}

	return s.repository.DeleteAgentTask(agent, taskID, purge)
}

func (s *Service) ForceResumeAgentTask(ctx context.Context, agentID, taskID string) error {
	agent, err := s.getAgent(agentID)
	if err != nil {
		return err
	}

	return s.repository.ForceResumeAgentTask(agent, taskID)
}

func (s *Service) SetAgentTaskShareLimit(ctx context.Context, agentID, taskID string, schema schemas.TaskSetShareLimitSchema) error {
	agent, err := s.getAgent(agentID)
	if err != nil {
		return err
	}

	return s.repository.SetAgentTaskShareLimit(agent, taskID, schema)
}

func (s *Service) SetAgentTaskLocation(ctx context.Context, agentID, taskID string, schema schemas.TaskSetLocationSchema) error {
	agent, err := s.getAgent(agentID)
	if err != nil {
		return err
	}

	return s.repository.SetAgentTaskLocation(agent, taskID, schema)
}

func (s *Service) RenameAgentTask(ctx context.Context, agentID, taskID string, schema schemas.TaskRenameSchema) error {
	agent, err := s.getAgent(agentID)
	if err != nil {
		return err
	}

	return s.repository.RenameAgentTask(agent, taskID, schema)
}

func (s *Service) SetAgentTaskSuperSeeding(ctx context.Context, agentID, taskID string, schema schemas.TaskSuperSeedingSchema) error {
	agent, err := s.getAgent(agentID)
	if err != nil {
		return err
	}

	return s.repository.SetAgentTaskSuperSeeding(agent, taskID, schema)
}

func (s *Service) ForceRecheckAgentTask(ctx context.Context, agentID, taskID string) error {
	agent, err := s.getAgent(agentID)
	if err != nil {
		return err
	}

	return s.repository.ForceRecheckAgentTask(agent, taskID)
}

func (s *Service) ForceReannounceAgentTask(ctx context.Context, agentID, taskID string) error {
	agent, err := s.getAgent(agentID)
	if err != nil {
		return err
	}

	return s.repository.ForceReannounceAgentTask(agent, taskID)
}

func (s *Service) SetAgentTaskDownloadLimit(ctx context.Context, agentID, taskID string, schema schemas.TaskSetDownloadLimitSchema) error {
	agent, err := s.getAgent(agentID)
	if err != nil {
		return err
	}

	return s.repository.SetAgentTaskDownloadLimit(agent, taskID, schema)
}

func (s *Service) SetAgentTaskUploadLimit(ctx context.Context, agentID, taskID string, schema schemas.TaskSetUploadLimitSchema) error {
	agent, err := s.getAgent(agentID)
	if err != nil {
		return err
	}

	return s.repository.SetAgentTaskUploadLimit(agent, taskID, schema)
}

func (s *Service) ListAgentTaskFiles(ctx context.Context, agentID, taskID string) ([]*entities.TaskFile, error) {
	agent, err := s.getAgent(agentID)
	if err != nil {
		return nil, err
	}

	files, err := s.repository.ListAgentTaskFiles(agent, taskID)
	if err != nil {
		return nil, fmt.Errorf("failed to list task files: %w", err)
	}

	for _, file := range files {
		file.Progress = file.Progress * 100
	}

	// Sort files by size, greatest first
	sort.Slice(files, func(i, j int) bool {
		return files[i].Size > files[j].Size
	})

	return files, nil
}

func (s *Service) GetAgentTasksStats(ctx context.Context, id string) (*entities.TaskStats, error) {
	agent, err := s.getAgent(id)
	if err != nil {
		return nil, err
	}

	stats, err := s.repository.GetAgentTasksStats(agent)
	if err != nil {
		return nil, fmt.Errorf("failed to get tasks stats: %w", err)
	}

	// Get total task count by listing all tasks
	allTasks, err := s.repository.ListAgentTasks(agent)
	if err != nil {
		return nil, fmt.Errorf("failed to get total tasks count: %w", err)
	}

	stats.TotalTasksCount = len(allTasks)

	// Calculate total disk size from all tasks
	var totalDiskSize int64
	for _, task := range allTasks {
		totalDiskSize += int64(task.Size)
	}
	stats.TotalDiskSize = totalDiskSize

	// Calculate word cloud from task names
	stats.WordCloud = s.calculateWordCloud(allTasks)

	return stats, nil
}

func (s *Service) GetAgentVersion(ctx context.Context, id string) (*entities.AgentVersion, error) {
	agent, err := s.getAgent(id)
	if err != nil {
		return nil, err
	}

	version, err := s.repository.GetAgentVersion(agent)
	if err != nil {
		return nil, fmt.Errorf("failed to get agent version: %w", err)
	}

	return version, nil
}

func (s *Service) SetAgentTaskTags(ctx context.Context, agentID, taskID string, schema schemas.TaskSetTagsSchema) error {
	agent, err := s.getAgent(agentID)
	if err != nil {
		return err
	}

	return s.repository.SetAgentTaskTags(agent, taskID, schema)
}

func (s *Service) SetAgentTaskCategory(ctx context.Context, agentID, taskID string, schema schemas.TaskSetCategorySchema) error {
	agent, err := s.getAgent(agentID)
	if err != nil {
		return err
	}

	return s.repository.SetAgentTaskCategory(agent, taskID, schema)
}

func (s *Service) GetAgentTaskLimits(ctx context.Context, agent *entities.Agent, taskID string) (*entities.TaskLimits, error) {
	return s.repository.GetAgentTaskLimits(agent, taskID)
}

func (s *Service) SetAgentGlobalSpeedLimits(ctx context.Context, agent *entities.Agent, schema schemas.InstanceSetSpeedLimitSchema) error {
	return s.repository.SetAgentGlobalSpeedLimits(agent, schema)
}

func (s *Service) SetAgentGlobalActiveLimits(ctx context.Context, agent *entities.Agent, schema schemas.InstanceSetMaxActiveTorrentLimitsSchema) error {
	return s.repository.SetAgentGlobalActiveLimits(agent, schema)
}
