package agentmanager

import (
	"context"
	"fmt"
	"sort"
	"strings"

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
	parsedID, err := uuid.Parse(id)
	if err != nil {
		return nil, fmt.Errorf("invalid UUID format: %w", err)
	}

	// Check if context is already cancelled
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}

	agent, err := s.repository.GetAgentByUUID(parsedID)
	if err != nil {
		return nil, fmt.Errorf("agent not found: %w", err)
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
	uid, err := uuid.Parse(agentID)
	if err != nil {
		return fmt.Errorf("invalid agent UUID format: %w", err)
	}

	agent, err := s.repository.GetAgentByUUID(uid)
	if err != nil {
		return fmt.Errorf("agent not found: %w", err)
	}

	return s.repository.StopAgentTask(agent, taskID)
}

func (s *Service) StartAgentTask(ctx context.Context, agentID, taskID string) error {
	uid, err := uuid.Parse(agentID)
	if err != nil {
		return fmt.Errorf("invalid agent UUID format: %w", err)
	}

	agent, err := s.repository.GetAgentByUUID(uid)
	if err != nil {
		return fmt.Errorf("agent not found: %w", err)
	}

	return s.repository.StartAgentTask(agent, taskID)
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

func (s *Service) GetAgentTask(ctx context.Context, agentID, taskID string) (*entities.Task, error) {
	uid, err := uuid.Parse(agentID)
	if err != nil {
		return nil, fmt.Errorf("invalid agent UUID format: %w", err)
	}

	agent, err := s.repository.GetAgentByUUID(uid)
	if err != nil {
		return nil, fmt.Errorf("agent not found: %w", err)
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
	uid, err := uuid.Parse(agentID)
	if err != nil {
		return fmt.Errorf("invalid agent UUID format: %w", err)
	}

	agent, err := s.repository.GetAgentByUUID(uid)
	if err != nil {
		return fmt.Errorf("agent not found: %w", err)
	}

	return s.repository.DeleteAgentTask(agent, taskID, purge)
}

func (s *Service) ForceResumeAgentTask(ctx context.Context, agentID, taskID string) error {
	uid, err := uuid.Parse(agentID)
	if err != nil {
		return fmt.Errorf("invalid agent UUID format: %w", err)
	}

	agent, err := s.repository.GetAgentByUUID(uid)
	if err != nil {
		return fmt.Errorf("agent not found: %w", err)
	}

	return s.repository.ForceResumeAgentTask(agent, taskID)
}

func (s *Service) SetAgentTaskShareLimit(ctx context.Context, agentID, taskID string, schema schemas.TaskSetShareLimitSchema) error {
	uid, err := uuid.Parse(agentID)
	if err != nil {
		return fmt.Errorf("invalid agent UUID format: %w", err)
	}

	agent, err := s.repository.GetAgentByUUID(uid)
	if err != nil {
		return fmt.Errorf("agent not found: %w", err)
	}

	return s.repository.SetAgentTaskShareLimit(agent, taskID, schema)
}

func (s *Service) SetAgentTaskLocation(ctx context.Context, agentID, taskID string, schema schemas.TaskSetLocationSchema) error {
	uid, err := uuid.Parse(agentID)
	if err != nil {
		return fmt.Errorf("invalid agent UUID format: %w", err)
	}

	agent, err := s.repository.GetAgentByUUID(uid)
	if err != nil {
		return fmt.Errorf("agent not found: %w", err)
	}

	return s.repository.SetAgentTaskLocation(agent, taskID, schema)
}

func (s *Service) RenameAgentTask(ctx context.Context, agentID, taskID string, schema schemas.TaskRenameSchema) error {
	uid, err := uuid.Parse(agentID)
	if err != nil {
		return fmt.Errorf("invalid agent UUID format: %w", err)
	}

	agent, err := s.repository.GetAgentByUUID(uid)
	if err != nil {
		return fmt.Errorf("agent not found: %w", err)
	}

	return s.repository.RenameAgentTask(agent, taskID, schema)
}

func (s *Service) SetAgentTaskSuperSeeding(ctx context.Context, agentID, taskID string, schema schemas.TaskSuperSeedingSchema) error {
	uid, err := uuid.Parse(agentID)
	if err != nil {
		return fmt.Errorf("invalid agent UUID format: %w", err)
	}

	agent, err := s.repository.GetAgentByUUID(uid)
	if err != nil {
		return fmt.Errorf("agent not found: %w", err)
	}

	return s.repository.SetAgentTaskSuperSeeding(agent, taskID, schema)
}

func (s *Service) ForceRecheckAgentTask(ctx context.Context, agentID, taskID string) error {
	uid, err := uuid.Parse(agentID)
	if err != nil {
		return fmt.Errorf("invalid agent UUID format: %w", err)
	}

	agent, err := s.repository.GetAgentByUUID(uid)
	if err != nil {
		return fmt.Errorf("agent not found: %w", err)
	}

	return s.repository.ForceRecheckAgentTask(agent, taskID)
}

func (s *Service) ForceReannounceAgentTask(ctx context.Context, agentID, taskID string) error {
	uid, err := uuid.Parse(agentID)
	if err != nil {
		return fmt.Errorf("invalid agent UUID format: %w", err)
	}

	agent, err := s.repository.GetAgentByUUID(uid)
	if err != nil {
		return fmt.Errorf("agent not found: %w", err)
	}

	return s.repository.ForceReannounceAgentTask(agent, taskID)
}

func (s *Service) SetAgentTaskDownloadLimit(ctx context.Context, agentID, taskID string, schema schemas.TaskSetDownloadLimitSchema) error {
	uid, err := uuid.Parse(agentID)
	if err != nil {
		return fmt.Errorf("invalid agent UUID format: %w", err)
	}

	agent, err := s.repository.GetAgentByUUID(uid)
	if err != nil {
		return fmt.Errorf("agent not found: %w", err)
	}

	return s.repository.SetAgentTaskDownloadLimit(agent, taskID, schema)
}

func (s *Service) SetAgentTaskUploadLimit(ctx context.Context, agentID, taskID string, schema schemas.TaskSetUploadLimitSchema) error {
	uid, err := uuid.Parse(agentID)
	if err != nil {
		return fmt.Errorf("invalid agent UUID format: %w", err)
	}

	agent, err := s.repository.GetAgentByUUID(uid)
	if err != nil {
		return fmt.Errorf("agent not found: %w", err)
	}

	return s.repository.SetAgentTaskUploadLimit(agent, taskID, schema)
}

func (s *Service) ListAgentTaskFiles(ctx context.Context, agentID, taskID string) ([]*entities.TaskFile, error) {
	uid, err := uuid.Parse(agentID)
	if err != nil {
		return nil, fmt.Errorf("invalid agent UUID format: %w", err)
	}

	agent, err := s.repository.GetAgentByUUID(uid)
	if err != nil {
		return nil, fmt.Errorf("agent not found: %w", err)
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
	uid, err := uuid.Parse(id)
	if err != nil {
		return nil, fmt.Errorf("invalid agent UUID format: %w", err)
	}

	agent, err := s.repository.GetAgentByUUID(uid)
	if err != nil {
		return nil, fmt.Errorf("agent not found: %w", err)
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
	uid, err := uuid.Parse(id)
	if err != nil {
		return nil, fmt.Errorf("invalid agent UUID format: %w", err)
	}

	agent, err := s.repository.GetAgentByUUID(uid)
	if err != nil {
		return nil, fmt.Errorf("agent not found: %w", err)
	}

	version, err := s.repository.GetAgentVersion(agent)
	if err != nil {
		return nil, fmt.Errorf("failed to get agent version: %w", err)
	}

	return version, nil
}

func (s *Service) SetAgentTaskTags(ctx context.Context, agentID, taskID string, schema schemas.TaskSetTagsSchema) error {
	uid, err := uuid.Parse(agentID)
	if err != nil {
		return fmt.Errorf("invalid agent UUID format: %w", err)
	}

	agent, err := s.repository.GetAgentByUUID(uid)
	if err != nil {
		return fmt.Errorf("agent not found: %w", err)
	}

	return s.repository.SetAgentTaskTags(agent, taskID, schema)
}

func (s *Service) SetAgentTaskCategory(ctx context.Context, agentID, taskID string, schema schemas.TaskSetCategorySchema) error {
	uid, err := uuid.Parse(agentID)
	if err != nil {
		return fmt.Errorf("invalid agent UUID format: %w", err)
	}

	agent, err := s.repository.GetAgentByUUID(uid)
	if err != nil {
		return fmt.Errorf("agent not found: %w", err)
	}

	return s.repository.SetAgentTaskCategory(agent, taskID, schema)
}

func (s *Service) GetAgentTaskLimits(ctx context.Context, agent *entities.Agent, taskID string) (*entities.TaskLimits, error) {
	return s.repository.GetAgentTaskLimits(agent, taskID)
}

// calculateWordCloud extracts and counts the top 25 most used terms in task names
func (s *Service) calculateWordCloud(tasks []*entities.Task) map[string]int {
	wordCount := make(map[string]int)

	// Common words to ignore (stop words)
	stopWords := map[string]bool{
		"the": true, "a": true, "an": true, "and": true, "or": true, "but": true,
		"in": true, "on": true, "at": true, "to": true, "for": true, "of": true,
		"with": true, "by": true, "is": true, "are": true, "was": true, "were": true,
		"be": true, "been": true, "have": true, "has": true, "had": true, "do": true,
		"does": true, "did": true, "will": true, "would": true, "could": true, "should": true,
		"may": true, "might": true, "must": true, "can": true, "this": true, "that": true,
		"these": true, "those": true, "i": true, "you": true, "he": true, "she": true,
		"it": true, "we": true, "they": true, "me": true, "him": true, "her": true,
		"us": true, "them": true, "my": true, "your": true, "his": true, "its": true,
		"our": true, "their": true, "from": true, "up": true, "down": true,
		"out": true, "off": true, "over": true, "under": true, "again": true, "further": true,
		"then": true, "once": true, "here": true, "there": true, "when": true, "where": true,
		"why": true, "how": true, "all": true, "any": true, "both": true, "each": true,
		"few": true, "more": true, "most": true, "other": true, "some": true, "such": true,
		"no": true, "nor": true, "not": true, "only": true, "own": true, "same": true,
		"so": true, "than": true, "too": true, "very": true, "s": true, "t": true,
		"just": true, "don": true, "now": true,
		"d": true, "ll": true, "m": true, "o": true, "re": true, "ve": true, "y": true,
		"ain": true, "aren": true, "couldn": true, "didn": true, "doesn": true, "hadn": true,
		"hasn": true, "haven": true, "isn": true, "ma": true, "mightn": true, "mustn": true,
		"needn": true, "shan": true, "shouldn": true, "wasn": true, "weren": true, "won": true,
		"wouldn": true,
	}

	// Extract words from each task name
	for _, task := range tasks {
		if task.Name == "" {
			continue
		}

		// Convert to lowercase and split by common delimiters
		text := strings.ToLower(task.Name)
		// Replace common delimiters with spaces
		text = strings.ReplaceAll(text, ".", " ")
		text = strings.ReplaceAll(text, "_", " ")
		text = strings.ReplaceAll(text, "-", " ")
		text = strings.ReplaceAll(text, "(", " ")
		text = strings.ReplaceAll(text, ")", " ")
		text = strings.ReplaceAll(text, "[", " ")
		text = strings.ReplaceAll(text, "]", " ")
		text = strings.ReplaceAll(text, "{", " ")
		text = strings.ReplaceAll(text, "}", " ")
		text = strings.ReplaceAll(text, ":", " ")
		text = strings.ReplaceAll(text, ";", " ")
		text = strings.ReplaceAll(text, ",", " ")
		text = strings.ReplaceAll(text, "!", " ")
		text = strings.ReplaceAll(text, "?", " ")
		text = strings.ReplaceAll(text, "@", " ")
		text = strings.ReplaceAll(text, "#", " ")
		text = strings.ReplaceAll(text, "$", " ")
		text = strings.ReplaceAll(text, "%", " ")
		text = strings.ReplaceAll(text, "^", " ")
		text = strings.ReplaceAll(text, "&", " ")
		text = strings.ReplaceAll(text, "*", " ")
		text = strings.ReplaceAll(text, "+", " ")
		text = strings.ReplaceAll(text, "=", " ")
		text = strings.ReplaceAll(text, "|", " ")
		text = strings.ReplaceAll(text, "\\", " ")
		text = strings.ReplaceAll(text, "/", " ")
		text = strings.ReplaceAll(text, "<", " ")
		text = strings.ReplaceAll(text, ">", " ")
		text = strings.ReplaceAll(text, "~", " ")
		text = strings.ReplaceAll(text, "`", " ")

		// Split into words
		words := strings.Fields(text)

		// Count each word (skip stop words and very short words)
		for _, word := range words {
			// Clean the word (remove any remaining non-alphanumeric characters)
			word = strings.TrimSpace(word)
			if len(word) < 3 || stopWords[word] {
				continue
			}

			// Only count words that contain at least one letter
			hasLetter := false
			for _, char := range word {
				if (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') {
					hasLetter = true
					break
				}
			}

			if hasLetter {
				wordCount[word]++
			}
		}
	}

	// Convert to slice for sorting
	type wordCountPair struct {
		word  string
		count int
	}

	var pairs []wordCountPair
	for word, count := range wordCount {
		pairs = append(pairs, wordCountPair{word, count})
	}

	// Sort by count (descending) and then by word (ascending) for consistency
	sort.Slice(pairs, func(i, j int) bool {
		if pairs[i].count == pairs[j].count {
			return pairs[i].word < pairs[j].word
		}
		return pairs[i].count > pairs[j].count
	})

	// Take top 25 and convert back to map
	result := make(map[string]int)
	maxCount := 25
	if len(pairs) < maxCount {
		maxCount = len(pairs)
	}

	for i := 0; i < maxCount; i++ {
		result[pairs[i].word] = pairs[i].count
	}

	return result
}
