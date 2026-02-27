package agent

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jfxdev/gardarr/internal/constants"
	"github.com/jfxdev/gardarr/internal/entities"
	"github.com/jfxdev/gardarr/internal/infra/database"
	"github.com/jfxdev/gardarr/internal/mappers"
	"github.com/jfxdev/gardarr/internal/models"
	"github.com/jfxdev/gardarr/internal/schemas"
	"github.com/jfxdev/gardarr/internal/services/crypto"
	"github.com/jfxdev/gardarr/pkg/env"
	"github.com/jfxdev/gardarr/pkg/logger"
	"github.com/jfxdev/gardarr/pkg/version"
	"github.com/jfxdev/go-qbt"
	"gorm.io/gorm"
)

type Repository struct {
	db              *database.Database
	crypto          *crypto.CryptoService
	http            *http.Client
	standaloneAgent *entities.Agent
}

const (
	StatusConnected    = qbt.StatusConnected
	StatusUnauthorized = qbt.StatusUnauthorized
	StatusUnaccessible = qbt.StatusUnaccessible
)

func NewRepository(db *database.Database, crypto *crypto.CryptoService) (*Repository, error) {
	var standaloneAgent *entities.Agent

	if env.Get(constants.AppModeEnv).Value() == constants.StandaloneMode {
		token, err := crypto.Encrypt(env.Get(constants.AgentSecretEnv).Value())
		if err != nil {
			return nil, err
		}

		standaloneAgent = &entities.Agent{
			UUID:       constants.StandaloneAgentUUID,
			Name:       "Standalone",
			Address:    constants.StandaloneAgentAddress,
			Token:      token,
			Icon:       "MemoryStick",
			Standalone: true,
			Status:     entities.AgentStatusActive,
		}
	}

	// Get timeout from environment variable or use default
	timeoutSeconds := constants.DefaultAgentTimeoutSeconds
	if timeoutEnv := env.Get(constants.AgentTimeoutSecondsEnv); timeoutEnv.Value() != "" {
		if parsedTimeout, err := strconv.Atoi(timeoutEnv.Value()); err == nil && parsedTimeout > 0 {
			timeoutSeconds = parsedTimeout
		}
	}

	// Create HTTP client with timeout
	httpClient := &http.Client{
		Timeout: time.Duration(timeoutSeconds) * time.Second,
	}

	return &Repository{
		db:              db,
		crypto:          crypto,
		http:            httpClient,
		standaloneAgent: standaloneAgent,
	}, nil

}

// Create inserts a new instance into the database
func (r *Repository) CreateAgent(ctx context.Context, agent entities.Agent) (*entities.Agent, error) {
	encToken, err := r.crypto.Encrypt(agent.Token)
	if err != nil {
		return nil, err
	}

	handler := &models.Agent{
		Name:            agent.Name,
		Address:         agent.Address,
		EncrypetedToken: encToken,
		Icon:            agent.Icon,
		Color:           agent.Color,
	}

	if err := r.db.DB.Create(handler).Error; err != nil {
		if errors.Is(err, gorm.ErrDuplicatedKey) || strings.Contains(err.Error(), "UNIQUE constraint failed") {
			return nil, errors.New("agent already exists")
		}

		return nil, err
	}

	return toAgent(*handler), nil
}

// List retrieves all agents from the database
func (r *Repository) ListAgents() ([]*entities.Agent, error) {
	var handler []models.Agent
	if err := r.db.DB.Find(&handler).Error; err != nil {
		return nil, err
	}

	result := make([]*entities.Agent, len(handler))
	for i, item := range handler {
		result[i] = toAgent(item)
	}

	// Check if APP_MODE is set to standalone and add mock agent
	if env.Get(constants.AppModeEnv).Value() == constants.StandaloneMode && r.standaloneAgent != nil {
		standaloneCopy := *r.standaloneAgent
		result = append(result, &standaloneCopy)
	}

	return result, nil
}

// GetByUUID retrieves a single instance by its UUID
func (r *Repository) GetAgentByUUID(uid uuid.UUID) (*entities.Agent, error) {
	// Check if APP_MODE is set to standalone and add mock agent
	if uid == constants.StandaloneAgentUUID && r.standaloneAgent != nil {
		standaloneCopy := *r.standaloneAgent
		return &standaloneCopy, nil
	}

	var handler models.Agent
	if err := r.db.DB.Where("uuid = ?", uid).First(&handler).Error; err != nil {
		return nil, err
	}

	return toAgent(handler), nil
}

func (r *Repository) isAvailable(agent *entities.Agent) error {
	return r.CheckAgentAvailability(agent)
}

// AgentError represents a structured error with classification for agents
type AgentError struct {
	Code      entities.AgentErrorCode
	Message   string
	Permanent bool
}

func (e *AgentError) Error() string {
	return e.Message
}

// classifyHTTPStatusCode classifies an HTTP status code into an AgentError
func classifyHTTPStatusCode(statusCode int) *AgentError {
	switch statusCode {
	case http.StatusUnauthorized, http.StatusForbidden:
		return &AgentError{
			Code:      entities.AgentErrorCodeAuthFailure,
			Message:   "Authentication failed",
			Permanent: true,
		}
	case http.StatusBadGateway:
		return &AgentError{
			Code:      entities.AgentErrorCodeBadGateway,
			Message:   "Bad Gateway - check proxy configuration",
			Permanent: false,
		}
	case http.StatusServiceUnavailable:
		return &AgentError{
			Code:      entities.AgentErrorCodeServiceUnavailable,
			Message:   "Service temporarily unavailable",
			Permanent: false,
		}
	case http.StatusGatewayTimeout:
		return &AgentError{
			Code:      entities.AgentErrorCodeTimeout,
			Message:   "Gateway timeout",
			Permanent: false,
		}
	default:
		return &AgentError{
			Code:      entities.AgentErrorCodeAgentUnreachable,
			Message:   fmt.Sprintf("Agent returned status code %d", statusCode),
			Permanent: false,
		}
	}
}

// classifyAgentError classifies an HTTP request error into an AgentError
// using the go-qbt error classification and mapping to agent error codes
func classifyAgentError(err error) *AgentError {
	if err == nil {
		return nil
	}

	// Use go-qbt's ClassifyError to get the classification
	clientErr := qbt.ClassifyError(err)

	// Map qbt error codes to agent error codes
	return &AgentError{
		Code:      mapQbtErrorCode(clientErr.Code),
		Message:   clientErr.Message,
		Permanent: clientErr.Permanent,
	}
}

// mapQbtErrorCode maps a qbt.ErrorCode to an entities.AgentErrorCode
func mapQbtErrorCode(code qbt.ErrorCode) entities.AgentErrorCode {
	switch code {
	case qbt.ErrorCodeAuthFailure:
		return entities.AgentErrorCodeAuthFailure
	case qbt.ErrorCodeTimeout:
		return entities.AgentErrorCodeTimeout
	case qbt.ErrorCodeDNS:
		return entities.AgentErrorCodeDNS
	case qbt.ErrorCodeHTTPSRequired:
		return entities.AgentErrorCodeHTTPSRequired
	case qbt.ErrorCodeSSLError:
		return entities.AgentErrorCodeSSLError
	case qbt.ErrorCodeVersionIncompatible:
		return entities.AgentErrorCodeVersionIncompatible
	case qbt.ErrorCodeConnectionRefused:
		return entities.AgentErrorCodeConnectionRefused
	case qbt.ErrorCodeNetworkUnreachable:
		return entities.AgentErrorCodeNetworkUnreachable
	case qbt.ErrorCodeBadGateway:
		return entities.AgentErrorCodeBadGateway
	case qbt.ErrorCodeServiceUnavailable:
		return entities.AgentErrorCodeServiceUnavailable
	case qbt.ErrorCodeUnknown:
		return entities.AgentErrorCodeUnknown
	default:
		return entities.AgentErrorCodeAgentUnreachable
	}
}

// isValidAgentErrorCode validates if a given code is a known AgentErrorCode constant
func isValidAgentErrorCode(code entities.AgentErrorCode) bool {
	switch code {
	case entities.AgentErrorCodeNone,
		entities.AgentErrorCodeAuthFailure,
		entities.AgentErrorCodeTimeout,
		entities.AgentErrorCodeDNS,
		entities.AgentErrorCodeHTTPSRequired,
		entities.AgentErrorCodeSSLError,
		entities.AgentErrorCodeVersionIncompatible,
		entities.AgentErrorCodeConnectionRefused,
		entities.AgentErrorCodeNetworkUnreachable,
		entities.AgentErrorCodeAgentUnreachable,
		entities.AgentErrorCodeBadGateway,
		entities.AgentErrorCodeServiceUnavailable,
		entities.AgentErrorCodeUnknown:
		return true
	default:
		return false
	}
}

// CheckAgentAvailability checks if the agent is available and accessible
func (r *Repository) CheckAgentAvailability(agent *entities.Agent) error {
	url := fmt.Sprintf("%s/v1/health/liveness", agent.Address)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		agentErr := classifyAgentError(err)
		logger.Error("agent availability check failed",
			"agent", agent.Name,
			"address", agent.Address,
			"error_code", agentErr.Code,
			"error", err.Error(),
		)
		return agentErr
	}

	response, err := r.http.Do(req)
	if err != nil {
		agentErr := classifyAgentError(err)
		logger.Error("agent connection failed",
			"agent", agent.Name,
			"address", agent.Address,
			"error_code", agentErr.Code,
			"error", err.Error(),
		)
		return agentErr
	}

	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		agentErr := classifyHTTPStatusCode(response.StatusCode)
		logger.Error("agent returned error status",
			"agent", agent.Name,
			"address", agent.Address,
			"status_code", response.StatusCode,
			"error_code", agentErr.Code,
		)
		return agentErr
	}

	var handler models.AgentLivenessResponse
	body, err := io.ReadAll(response.Body)
	if err != nil {
		// Body read errors are I/O issues, not network errors
		agentErr := &AgentError{
			Code:      entities.AgentErrorCodeUnknown,
			Message:   fmt.Sprintf("failed to read response body: %v", err),
			Permanent: false,
		}
		logger.Error("failed to read agent response",
			"agent", agent.Name,
			"error", err.Error(),
		)
		return agentErr
	}

	if err := json.Unmarshal(body, &handler); err != nil {
		// JSON parse errors are data format issues, not network errors
		agentErr := &AgentError{
			Code:      entities.AgentErrorCodeUnknown,
			Message:   fmt.Sprintf("failed to parse response: %v", err),
			Permanent: false,
		}
		logger.Error("failed to parse agent response",
			"agent", agent.Name,
			"error", err.Error(),
		)
		return agentErr
	}

	// Check for specific status codes from the agent
	switch handler.Status {
	case qbt.StatusUnauthorized:
		logger.Error("qBittorrent authentication failed",
			"agent", agent.Name,
			"address", agent.Address,
			"error_code", entities.AgentErrorCodeAuthFailure,
		)
		return &AgentError{
			Code:      entities.AgentErrorCodeAuthFailure,
			Message:   "Invalid qBittorrent username or password",
			Permanent: true,
		}
	case qbt.StatusUnaccessible:
		// Use the detailed error from the response if available
		if handler.ErrorCode != "" {
			candidateCode := entities.AgentErrorCode(handler.ErrorCode)
			errorCode := entities.AgentErrorCodeConnectionRefused // Safe default

			if isValidAgentErrorCode(candidateCode) {
				errorCode = candidateCode
			} else {
				logger.Warn("unknown agent error code received, using fallback",
					"agent", agent.Name,
					"received_code", handler.ErrorCode,
					"fallback_code", errorCode,
				)
			}

			logger.Error("qBittorrent not accessible",
				"agent", agent.Name,
				"address", agent.Address,
				"error_code", errorCode,
				"message", handler.Message,
				"permanent", handler.Permanent,
			)
			return &AgentError{
				Code:      errorCode,
				Message:   handler.Message,
				Permanent: handler.Permanent,
			}
		}
		return &AgentError{
			Code:      entities.AgentErrorCodeConnectionRefused,
			Message:   "qBittorrent instance is not accessible",
			Permanent: false,
		}
	case qbt.StatusInitializing:
		logger.Info("qBittorrent is currently initializing",
			"agent", agent.Name,
			"address", agent.Address,
		)
		return &AgentError{
			Code:      entities.AgentErrorCodeServiceUnavailable,
			Message:   "qBittorrent is starting up",
			Permanent: false,
		}
	}

	return nil
}

// GetByUUID retrieves a single instance by its UUID
func (r *Repository) GetInstance(agent *entities.Agent) (*entities.Instance, error) {
	if err := r.isAvailable(agent); err != nil {
		return nil, err
	}

	url := fmt.Sprintf("%s/v1/instance", agent.Address)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	var decryptedToken string
	if agent.Standalone {
		decryptedToken = env.Get(constants.AgentSecretEnv).Value()
	} else {
		decryptedToken, err = r.crypto.Decrypt(agent.Token)
		if err != nil {
			return nil, err
		}
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", decryptedToken))

	response, err := r.http.Do(req)
	if err != nil {
		return nil, err
	}

	if response.StatusCode != http.StatusOK {
		return nil, errors.New("failed to get instance")
	}

	var handler models.InstanceResponse
	body, err := io.ReadAll(response.Body)
	defer response.Body.Close()
	if err != nil {
		return nil, err
	}

	if err := json.NewDecoder(bytes.NewReader(body)).Decode(&handler); err != nil {
		return nil, err
	}

	return mappers.ToInstance(handler), nil
}

func (r *Repository) GetInstanceWithoutDecrypt(agent *entities.Agent) (*entities.Instance, error) {
	url := fmt.Sprintf("%s/v1/instance", agent.Address)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", agent.Token))

	response, err := r.http.Do(req)
	if err != nil {
		return nil, err
	}

	if response.StatusCode != http.StatusOK {
		return nil, errors.New("failed to get instance")
	}

	var handler models.InstanceResponse
	body, err := io.ReadAll(response.Body)
	defer response.Body.Close()
	if err != nil {
		return nil, err
	}

	if err := json.NewDecoder(bytes.NewReader(body)).Decode(&handler); err != nil {
		return nil, err
	}

	return mappers.ToInstance(handler), nil
}

func (r *Repository) GetAgentVersion(agent *entities.Agent) (*entities.AgentVersion, error) {
	if agent.Standalone {
		return &entities.AgentVersion{
			Version: version.Version,
			Commit:  version.Commit,
			Date:    version.Date,
		}, nil
	}

	if err := r.isAvailable(agent); err != nil {
		return nil, err
	}

	url := fmt.Sprintf("%s/v1/version", agent.Address)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	decryptedToken, err := r.crypto.Decrypt(agent.Token)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", decryptedToken))

	response, err := r.http.Do(req)
	if err != nil {
		return nil, err
	}

	if response.StatusCode != http.StatusOK {
		return nil, errors.New("failed to get version")
	}

	var handler models.AgentVersionResponse
	body, err := io.ReadAll(response.Body)
	if err != nil {
		return nil, err
	}

	if err := json.NewDecoder(bytes.NewReader(body)).Decode(&handler); err != nil {
		return nil, err
	}

	return mappers.ToAgentVersion(handler), nil
}

func (r *Repository) GetAgentTasksStats(agent *entities.Agent) (*entities.TaskStats, error) {
	url := fmt.Sprintf("%s/v1/tasks/stats", agent.Address)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	decryptedToken, err := r.crypto.Decrypt(agent.Token)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", decryptedToken))

	response, err := r.http.Do(req)
	if err != nil {
		return nil, err
	}

	if response.StatusCode != http.StatusOK {
		return nil, errors.New("failed to get tasks stats")
	}

	var handler models.TaskStatsResponse
	body, err := io.ReadAll(response.Body)
	if err != nil {
		return nil, err
	}

	if err := json.NewDecoder(bytes.NewReader(body)).Decode(&handler); err != nil {
		return nil, err
	}

	return mappers.ToTaskStats(handler), nil
}

func (r *Repository) GetAgentPreferences(agent *entities.Agent) (*entities.InstancePreferences, error) {
	url := fmt.Sprintf("%s/v1/instance/preferences", agent.Address)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	decryptedToken, err := r.crypto.Decrypt(agent.Token)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", decryptedToken))

	response, err := r.http.Do(req)
	if err != nil {
		return nil, err
	}

	body, err := io.ReadAll(response.Body)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		return nil, errors.New("failed to get preferences")
	}

	var handler models.InstancePreferencesResponse
	if err := json.NewDecoder(bytes.NewReader(body)).Decode(&handler); err != nil {
		return nil, err
	}

	return mappers.ToInstancePreferences(handler), nil
}

// UpdateAgent updates an existing agent in the database
func (r *Repository) UpdateAgent(ctx context.Context, uid uuid.UUID, updates map[string]interface{}) (*entities.Agent, error) {
	var agent models.Agent

	// First, get the existing agent
	if err := r.db.DB.Where("uuid = ?", uid).First(&agent).Error; err != nil {
		return nil, err
	}

	// If token is being updated, encrypt it
	if token, exists := updates["token"]; exists {
		if tokenStr, ok := token.(string); ok {
			encToken, err := r.crypto.Encrypt(tokenStr)
			if err != nil {
				return nil, err
			}
			updates["EncrypetedToken"] = encToken
			delete(updates, "token")
		}
	}

	// Update the agent
	if err := r.db.DB.Model(&agent).Updates(updates).Error; err != nil {
		return nil, err
	}

	// Get the updated agent
	if err := r.db.DB.Where("uuid = ?", uid).First(&agent).Error; err != nil {
		return nil, err
	}

	return toAgent(agent), nil
}

// Delete removes an agent from the database by UUID
func (r *Repository) DeleteAgent(uid uuid.UUID) error {
	if err := r.db.DB.Where("uuid = ?", uid).Delete(&models.Agent{}).Error; err != nil {
		return err
	}

	return nil
}

func (r *Repository) ListAgentTasks(agent *entities.Agent) ([]*entities.Task, error) {
	url := fmt.Sprintf("%s/v1/tasks", agent.Address)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	decryptedToken, err := r.crypto.Decrypt(agent.Token)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", decryptedToken))

	response, err := r.http.Do(req)
	if err != nil {
		return nil, err
	}

	if response.StatusCode != http.StatusOK {
		return nil, errors.New("failed to list tasks")
	}

	var handler []models.TaskResponseModel
	body, err := io.ReadAll(response.Body)
	defer response.Body.Close()
	if err != nil {
		return nil, err
	}

	if err := json.NewDecoder(bytes.NewReader(body)).Decode(&handler); err != nil {
		return nil, err
	}

	result := make([]*entities.Task, len(handler))
	for i, item := range handler {
		task := mappers.ToTask(item)
		result[i] = task
	}

	return result, nil
}

func (r *Repository) CreateAgentTask(agent *entities.Agent, schema schemas.TaskCreateSchema) (*entities.Task, error) {
	url := fmt.Sprintf("%s/v1/task", agent.Address)

	payload, err := json.Marshal(schema)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest("POST", url, bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}

	decryptedToken, err := r.crypto.Decrypt(agent.Token)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", decryptedToken))

	response, err := r.http.Do(req)
	if err != nil {
		return nil, err
	}

	if response.StatusCode != http.StatusOK {
		return nil, errors.New("failed to create task")
	}

	var handler models.TaskResponseModel
	body, err := io.ReadAll(response.Body)
	defer response.Body.Close()
	if err != nil {
		return nil, err
	}

	if err := json.NewDecoder(bytes.NewReader(body)).Decode(&handler); err != nil {
		return nil, err
	}

	return mappers.ToTask(handler), nil
}

func (r *Repository) DeleteAgentTask(agent *entities.Agent, id string, purge bool) error {
	baseURL := fmt.Sprintf("%s/v1/task/%s", agent.Address, id)

	parsedURL, err := url.Parse(baseURL)
	if err != nil {
		return err
	}

	query := parsedURL.Query()
	query.Set("purge", strconv.FormatBool(purge))
	parsedURL.RawQuery = query.Encode()

	req, err := http.NewRequest("DELETE", parsedURL.String(), nil)
	if err != nil {
		return err
	}

	decryptedToken, err := r.crypto.Decrypt(agent.Token)
	if err != nil {
		return err
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", decryptedToken))

	response, err := r.http.Do(req)
	if err != nil {
		return err
	}

	if response.StatusCode != http.StatusOK {
		return errors.New("failed to delete task")
	}

	return nil
}

func (r *Repository) StopAgentTask(agent *entities.Agent, taskID string) error {
	url := fmt.Sprintf("%s/v1/task/%s/stop", agent.Address, taskID)

	req, err := http.NewRequest("POST", url, nil)
	if err != nil {
		return err
	}

	decryptedToken, err := r.crypto.Decrypt(agent.Token)
	if err != nil {
		return err
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", decryptedToken))

	response, err := r.http.Do(req)
	if err != nil {
		return err
	}

	if response.StatusCode != http.StatusOK {
		return errors.New("failed to stop task")
	}

	return nil
}

func (r *Repository) StartAgentTask(agent *entities.Agent, taskID string) error {
	url := fmt.Sprintf("%s/v1/task/%s/start", agent.Address, taskID)

	req, err := http.NewRequest("POST", url, nil)
	if err != nil {
		return err
	}

	decryptedToken, err := r.crypto.Decrypt(agent.Token)
	if err != nil {
		return err
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", decryptedToken))

	response, err := r.http.Do(req)
	if err != nil {
		return err
	}

	if response.StatusCode != http.StatusOK {
		return errors.New("failed to start task")
	}

	return nil
}

func (r *Repository) ForceDownloadAgentTask(agent *entities.Agent, taskID string) error {
	url := fmt.Sprintf("%s/v1/task/%s/force_reannounce", agent.Address, taskID)

	req, err := http.NewRequest("POST", url, nil)
	if err != nil {
		return err
	}

	decryptedToken, err := r.crypto.Decrypt(agent.Token)
	if err != nil {
		return err
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", decryptedToken))

	response, err := r.http.Do(req)
	if err != nil {
		return err
	}

	if response.StatusCode != http.StatusOK {
		return errors.New("failed to force reannounce task")
	}

	return nil
}

func (r *Repository) GetAgentTask(agent *entities.Agent, taskID string) (*entities.Task, error) {
	url := fmt.Sprintf("%s/v1/task/%s", agent.Address, taskID)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	decryptedToken, err := r.crypto.Decrypt(agent.Token)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", decryptedToken))

	response, err := r.http.Do(req)
	if err != nil {
		return nil, err
	}

	if response.StatusCode != http.StatusOK {
		return nil, errors.New("failed to get task")
	}

	var handler models.TaskResponseModel
	body, err := io.ReadAll(response.Body)
	defer response.Body.Close()
	if err != nil {
		return nil, err
	}

	if err := json.NewDecoder(bytes.NewReader(body)).Decode(&handler); err != nil {
		return nil, err
	}

	task := mappers.ToTask(handler)

	return task, nil
}

func (r *Repository) ForceResumeAgentTask(agent *entities.Agent, taskID string) error {
	url := fmt.Sprintf("%s/v1/task/%s/force_resume", agent.Address, taskID)

	req, err := http.NewRequest("POST", url, nil)
	if err != nil {
		return err
	}

	decryptedToken, err := r.crypto.Decrypt(agent.Token)
	if err != nil {
		return err
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", decryptedToken))

	response, err := r.http.Do(req)
	if err != nil {
		return err
	}

	if response.StatusCode != http.StatusOK {
		return errors.New("failed to force resume task")
	}

	return nil
}

func (r *Repository) SetAgentTaskShareLimit(agent *entities.Agent, taskID string, schema schemas.TaskSetShareLimitSchema) error {
	url := fmt.Sprintf("%s/v1/task/%s/share_limit", agent.Address, taskID)

	payload, err := json.Marshal(schema)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("PUT", url, bytes.NewReader(payload))
	if err != nil {
		return err
	}

	decryptedToken, err := r.crypto.Decrypt(agent.Token)
	if err != nil {
		return err
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", decryptedToken))
	req.Header.Set("Content-Type", "application/json")

	response, err := r.http.Do(req)
	if err != nil {
		return err
	}

	if response.StatusCode != http.StatusOK {
		return errors.New("failed to set task share limit")
	}

	return nil
}

func (r *Repository) SetAgentTaskLocation(agent *entities.Agent, taskID string, schema schemas.TaskSetLocationSchema) error {
	url := fmt.Sprintf("%s/v1/task/%s/location", agent.Address, taskID)

	payload, err := json.Marshal(schema)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", url, bytes.NewReader(payload))
	if err != nil {
		return err
	}

	decryptedToken, err := r.crypto.Decrypt(agent.Token)
	if err != nil {
		return err
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", decryptedToken))
	req.Header.Set("Content-Type", "application/json")

	response, err := r.http.Do(req)
	if err != nil {
		return err
	}

	if response.StatusCode != http.StatusOK {
		return errors.New("failed to set task location")
	}

	return nil
}

func (r *Repository) RenameAgentTask(agent *entities.Agent, taskID string, schema schemas.TaskRenameSchema) error {
	url := fmt.Sprintf("%s/v1/task/%s/rename", agent.Address, taskID)

	payload, err := json.Marshal(schema)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", url, bytes.NewReader(payload))
	if err != nil {
		return err
	}

	decryptedToken, err := r.crypto.Decrypt(agent.Token)
	if err != nil {
		return err
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", decryptedToken))
	req.Header.Set("Content-Type", "application/json")

	response, err := r.http.Do(req)
	if err != nil {
		return err
	}

	if response.StatusCode != http.StatusOK {
		return errors.New("failed to rename task")
	}

	return nil
}

func (r *Repository) SetAgentTaskSuperSeeding(agent *entities.Agent, taskID string, schema schemas.TaskSuperSeedingSchema) error {
	url := fmt.Sprintf("%s/v1/task/%s/super_seeding", agent.Address, taskID)

	payload, err := json.Marshal(schema)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", url, bytes.NewReader(payload))
	if err != nil {
		return err
	}

	decryptedToken, err := r.crypto.Decrypt(agent.Token)
	if err != nil {
		return err
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", decryptedToken))
	req.Header.Set("Content-Type", "application/json")

	response, err := r.http.Do(req)
	if err != nil {
		return err
	}

	if response.StatusCode != http.StatusOK {
		return errors.New("failed to set task super seeding")
	}

	return nil
}

func (r *Repository) ForceRecheckAgentTask(agent *entities.Agent, taskID string) error {
	url := fmt.Sprintf("%s/v1/task/%s/force_recheck", agent.Address, taskID)

	req, err := http.NewRequest("POST", url, nil)
	if err != nil {
		return err
	}

	decryptedToken, err := r.crypto.Decrypt(agent.Token)
	if err != nil {
		return err
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", decryptedToken))

	response, err := r.http.Do(req)
	if err != nil {
		return err
	}

	if response.StatusCode != http.StatusOK {
		return errors.New("failed to force recheck task")
	}

	return nil
}

func (r *Repository) ForceReannounceAgentTask(agent *entities.Agent, taskID string) error {
	url := fmt.Sprintf("%s/v1/task/%s/force_reannounce", agent.Address, taskID)

	req, err := http.NewRequest("POST", url, nil)
	if err != nil {
		return err
	}

	decryptedToken, err := r.crypto.Decrypt(agent.Token)
	if err != nil {
		return err
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", decryptedToken))

	response, err := r.http.Do(req)
	if err != nil {
		return err
	}

	if response.StatusCode != http.StatusOK {
		return errors.New("failed to force reannounce task")
	}

	return nil
}

func (r *Repository) SetAgentTaskDownloadLimit(agent *entities.Agent, taskID string, schema schemas.TaskSetDownloadLimitSchema) error {
	url := fmt.Sprintf("%s/v1/task/%s/limit_download_rate", agent.Address, taskID)

	payload, err := json.Marshal(schema)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", url, bytes.NewReader(payload))
	if err != nil {
		return err
	}

	decryptedToken, err := r.crypto.Decrypt(agent.Token)
	if err != nil {
		return err
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", decryptedToken))
	req.Header.Set("Content-Type", "application/json")

	response, err := r.http.Do(req)
	if err != nil {
		return err
	}

	if response.StatusCode != http.StatusOK {
		return errors.New("failed to set task download limit")
	}

	return nil
}

func (r *Repository) SetAgentTaskUploadLimit(agent *entities.Agent, taskID string, schema schemas.TaskSetUploadLimitSchema) error {
	url := fmt.Sprintf("%s/v1/task/%s/limit_upload_rate", agent.Address, taskID)

	payload, err := json.Marshal(schema)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", url, bytes.NewReader(payload))
	if err != nil {
		return err
	}

	decryptedToken, err := r.crypto.Decrypt(agent.Token)
	if err != nil {
		return err
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", decryptedToken))
	req.Header.Set("Content-Type", "application/json")

	response, err := r.http.Do(req)
	if err != nil {
		return err
	}

	if response.StatusCode != http.StatusOK {
		return errors.New("failed to set task upload limit")
	}

	return nil
}

func (r *Repository) ListAgentTaskFiles(agent *entities.Agent, taskID string) ([]*entities.TaskFile, error) {
	url := fmt.Sprintf("%s/v1/task/%s/files", agent.Address, taskID)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	decryptedToken, err := r.crypto.Decrypt(agent.Token)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", decryptedToken))

	response, err := r.http.Do(req)
	if err != nil {
		return nil, err
	}

	if response.StatusCode != http.StatusOK {
		return nil, errors.New("failed to list task files")
	}

	var handler []models.TaskFileResponse
	body, err := io.ReadAll(response.Body)
	defer response.Body.Close()
	if err != nil {
		return nil, err
	}

	if err := json.NewDecoder(bytes.NewReader(body)).Decode(&handler); err != nil {
		return nil, err
	}

	// Convert response models to entities
	result := make([]*entities.TaskFile, len(handler))
	for i, file := range handler {
		result[i] = &entities.TaskFile{
			Name:         file.Name,
			Size:         file.Size,
			Progress:     file.Progress,
			Priority:     file.Priority,
			IsSeed:       file.IsSeed,
			PieceRange:   file.PieceRange,
			Availability: file.Availability,
		}
	}

	return result, nil
}

func (r *Repository) SetAgentTaskTags(agent *entities.Agent, taskID string, schema schemas.TaskSetTagsSchema) error {
	url := fmt.Sprintf("%s/v1/task/%s/tags", agent.Address, taskID)

	payload, err := json.Marshal(schema)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("PUT", url, bytes.NewReader(payload))
	if err != nil {
		return err
	}

	decryptedToken, err := r.crypto.Decrypt(agent.Token)
	if err != nil {
		return err
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", decryptedToken))
	req.Header.Set("Content-Type", "application/json")

	response, err := r.http.Do(req)
	if err != nil {
		return err
	}

	if response.StatusCode != http.StatusOK {
		return errors.New("failed to set task tags")
	}

	return nil
}

func (r *Repository) SetAgentTaskCategory(agent *entities.Agent, taskID string, schema schemas.TaskSetCategorySchema) error {
	url := fmt.Sprintf("%s/v1/task/%s/category", agent.Address, taskID)

	payload, err := json.Marshal(schema)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("PUT", url, bytes.NewReader(payload))
	if err != nil {
		return err
	}

	decryptedToken, err := r.crypto.Decrypt(agent.Token)
	if err != nil {
		return err
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", decryptedToken))
	req.Header.Set("Content-Type", "application/json")

	response, err := r.http.Do(req)
	if err != nil {
		return err
	}

	if response.StatusCode != http.StatusOK {
		return errors.New("failed to set task category")
	}

	return nil
}

func (r *Repository) GetAgentTaskLimits(agent *entities.Agent, taskID string) (*entities.TaskLimits, error) {
	url := fmt.Sprintf("%s/v1/task/%s/limits", agent.Address, taskID)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	decryptedToken, err := r.crypto.Decrypt(agent.Token)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", decryptedToken))

	response, err := r.http.Do(req)
	if err != nil {
		return nil, err
	}

	if response.StatusCode != http.StatusOK {
		return nil, errors.New("failed to get task limits")
	}

	var handler models.TaskLimitsResponse
	body, err := io.ReadAll(response.Body)
	if err != nil {
		return nil, err
	}

	if err := json.NewDecoder(bytes.NewReader(body)).Decode(&handler); err != nil {
		return nil, err
	}

	return mappers.ToTaskLimits(handler), nil
}

func (r *Repository) SetAgentGlobalSpeedLimits(agent *entities.Agent, schema schemas.InstanceSetSpeedLimitSchema) error {
	url := fmt.Sprintf("%s/v1/instance/speed/limits", agent.Address)

	payload, err := json.Marshal(schema)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", url, bytes.NewReader(payload))
	if err != nil {
		return err
	}

	decryptedToken, err := r.crypto.Decrypt(agent.Token)
	if err != nil {
		return err
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", decryptedToken))
	req.Header.Set("Content-Type", "application/json")

	response, err := r.http.Do(req)
	if err != nil {
		return err
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		return errors.New("failed to set global speed limits")
	}

	return nil
}

func (r *Repository) SetAgentGlobalActiveLimits(agent *entities.Agent, schema schemas.InstanceSetMaxActiveTorrentLimitsSchema) error {
	url := fmt.Sprintf("%s/v1/instance/active/limits", agent.Address)

	payload, err := json.Marshal(schema)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", url, bytes.NewReader(payload))
	if err != nil {
		return err
	}

	decryptedToken, err := r.crypto.Decrypt(agent.Token)
	if err != nil {
		return err
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", decryptedToken))
	req.Header.Set("Content-Type", "application/json")

	response, err := r.http.Do(req)
	if err != nil {
		return err
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		return errors.New("failed to set global active limits")
	}

	return nil
}

func toAgent(item models.Agent) *entities.Agent {
	return &entities.Agent{
		UUID:    item.UUID,
		Name:    item.Name,
		Address: item.Address,
		Token:   item.EncrypetedToken,
		Icon:    item.Icon,
		Color:   item.Color,
	}
}
