package agent

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/gardarr/gardarr/internal/entities"
	"github.com/gardarr/gardarr/internal/infra/database"
	"github.com/gardarr/gardarr/internal/mappers"
	"github.com/gardarr/gardarr/internal/models"
	"github.com/gardarr/gardarr/internal/schemas"
	"github.com/gardarr/gardarr/internal/services/crypto"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Repository struct {
	db     *database.Database
	crypto *crypto.CryptoService
	http   *http.Client
}

func NewRepository(db *database.Database, crypto *crypto.CryptoService) *Repository {
	return &Repository{
		db:     db,
		crypto: crypto,
		http:   http.DefaultClient,
	}
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

	return result, nil
}

// GetByUUID retrieves a single instance by its UUID
func (r *Repository) GetAgentByUUID(uid uuid.UUID) (*entities.Agent, error) {
	var handler models.Agent
	if err := r.db.DB.Where("uuid = ?", uid).First(&handler).Error; err != nil {
		return nil, err
	}

	return toAgent(handler), nil
}

// GetByUUID retrieves a single instance by its UUID
func (r *Repository) GetInstance(agent *entities.Agent) (*entities.Instance, error) {
	url := fmt.Sprintf("%s/v1/instance", agent.Address)

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
		task.Agent = agent
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

func (r *Repository) DeleteAgentTask(agent *entities.Agent, id string) error {
	url := fmt.Sprintf("%s/v1/task/%s", agent.Address, id)

	req, err := http.NewRequest("DELETE", url, nil)
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

func (r *Repository) PauseAgentTask(agent *entities.Agent, taskID string) error {
	url := fmt.Sprintf("%s/v1/task/%s/pause", agent.Address, taskID)

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
		return errors.New("failed to pause task")
	}

	return nil
}

func (r *Repository) ResumeAgentTask(agent *entities.Agent, taskID string) error {
	url := fmt.Sprintf("%s/v1/task/%s/resume", agent.Address, taskID)

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
		return errors.New("failed to resume task")
	}

	return nil
}

func (r *Repository) ForceDownloadAgentTask(agent *entities.Agent, taskID string) error {
	url := fmt.Sprintf("%s/v1/task/%s/force_download", agent.Address, taskID)

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
		return errors.New("failed to force download task")
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
