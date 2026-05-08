package worker

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
	"github.com/jfxdev/gardarr/internal/workercheck"
	"github.com/jfxdev/gardarr/pkg/env"
	"github.com/jfxdev/gardarr/pkg/logger"
	"github.com/jfxdev/go-qbt"
	"gorm.io/gorm"
)

type Repository struct {
	db     *database.Database
	crypto *crypto.CryptoService
	http   *http.Client
}

const (
	StatusConnected    = qbt.StatusConnected
	StatusUnauthorized = qbt.StatusUnauthorized
	StatusUnaccessible = qbt.StatusUnaccessible
)

func NewRepository(db *database.Database, crypto *crypto.CryptoService) (*Repository, error) {
	// Get timeout from environment variable or use default
	timeoutSeconds := constants.DefaultWorkerTimeoutSeconds
	if timeoutEnv := env.Get(constants.WorkerTimeoutSecondsEnv); timeoutEnv.Value() != "" {
		if parsedTimeout, err := strconv.Atoi(timeoutEnv.Value()); err == nil && parsedTimeout > 0 {
			timeoutSeconds = parsedTimeout
		}
	}

	// Create HTTP client with timeout
	httpClient := &http.Client{
		Timeout: time.Duration(timeoutSeconds) * time.Second,
	}

	return &Repository{
		db:     db,
		crypto: crypto,
		http:   httpClient,
	}, nil

}

// CreateWorker inserts a new worker into the database
func (r *Repository) CreateWorker(ctx context.Context, worker entities.Worker) (*entities.Worker, error) {
	encToken, err := r.crypto.Encrypt(worker.Token)
	if err != nil {
		return nil, err
	}

	handler := &models.Worker{
		Name:            worker.Name,
		Address:         worker.Address,
		EncrypetedToken: encToken,
		Icon:            worker.Icon,
		Color:           worker.Color,
	}

	if err := r.db.DB.Create(handler).Error; err != nil {
		if errors.Is(err, gorm.ErrDuplicatedKey) || strings.Contains(err.Error(), "UNIQUE constraint failed") {
			return nil, errors.New("worker already exists")
		}

		return nil, err
	}

	return toWorker(*handler), nil
}

// ListWorkers retrieves all workers from the database
func (r *Repository) ListWorkers() ([]*entities.Worker, error) {
	var handler []models.Worker
	if err := r.db.DB.Find(&handler).Error; err != nil {
		return nil, err
	}

	result := make([]*entities.Worker, len(handler))
	for i, item := range handler {
		result[i] = toWorker(item)
	}

	return result, nil
}

func (r *Repository) GetWorkerByUUID(uid uuid.UUID) (*entities.Worker, error) {
	var handler models.Worker
	if err := r.db.DB.Where("uuid = ?", uid).First(&handler).Error; err != nil {
		return nil, err
	}

	return toWorker(handler), nil
}

func (r *Repository) isAvailable(worker *entities.Worker) error {
	return r.CheckWorkerAvailability(worker)
}

// WorkerError represents a structured error with classification for workers
type WorkerError struct {
	Code      entities.WorkerErrorCode
	Message   string
	Permanent bool
}

func (e *WorkerError) Error() string {
	return e.Message
}

// classifyHTTPStatusCode classifies an HTTP status code into a WorkerError
func classifyHTTPStatusCode(statusCode int) *WorkerError {
	switch statusCode {
	case http.StatusUnauthorized, http.StatusForbidden:
		return &WorkerError{
			Code:      entities.WorkerErrorCodeAuthFailure,
			Message:   "Authentication failed",
			Permanent: true,
		}
	case http.StatusBadGateway:
		return &WorkerError{
			Code:      entities.WorkerErrorCodeBadGateway,
			Message:   "Bad Gateway - check proxy configuration",
			Permanent: false,
		}
	case http.StatusServiceUnavailable:
		return &WorkerError{
			Code:      entities.WorkerErrorCodeServiceUnavailable,
			Message:   "Service temporarily unavailable",
			Permanent: false,
		}
	case http.StatusGatewayTimeout:
		return &WorkerError{
			Code:      entities.WorkerErrorCodeTimeout,
			Message:   "Gateway timeout",
			Permanent: false,
		}
	default:
		return &WorkerError{
			Code:      entities.WorkerErrorCodeWorkerUnreachable,
			Message:   fmt.Sprintf("Worker returned status code %d", statusCode),
			Permanent: false,
		}
	}
}

// classifyWorkerError classifies an HTTP request error into a WorkerError
// using the go-qbt error classification and mapping to worker error codes
func classifyWorkerError(err error) *WorkerError {
	if err == nil {
		return nil
	}

	// Use go-qbt's ClassifyError to get the classification
	clientErr := qbt.ClassifyError(err)

	// Map qbt error codes to worker error codes
	return &WorkerError{
		Code:      mapQbtErrorCode(clientErr.Code),
		Message:   clientErr.Message,
		Permanent: clientErr.Permanent,
	}
}

// mapQbtErrorCode maps a qbt.ErrorCode to an entities.WorkerErrorCode
func mapQbtErrorCode(code qbt.ErrorCode) entities.WorkerErrorCode {
	switch code {
	case qbt.ErrorCodeAuthFailure:
		return entities.WorkerErrorCodeAuthFailure
	case qbt.ErrorCodeTimeout:
		return entities.WorkerErrorCodeTimeout
	case qbt.ErrorCodeDNS:
		return entities.WorkerErrorCodeDNS
	case qbt.ErrorCodeHTTPSRequired:
		return entities.WorkerErrorCodeHTTPSRequired
	case qbt.ErrorCodeSSLError:
		return entities.WorkerErrorCodeSSLError
	case qbt.ErrorCodeVersionIncompatible:
		return entities.WorkerErrorCodeVersionIncompatible
	case qbt.ErrorCodeConnectionRefused:
		return entities.WorkerErrorCodeConnectionRefused
	case qbt.ErrorCodeNetworkUnreachable:
		return entities.WorkerErrorCodeNetworkUnreachable
	case qbt.ErrorCodeBadGateway:
		return entities.WorkerErrorCodeBadGateway
	case qbt.ErrorCodeServiceUnavailable:
		return entities.WorkerErrorCodeServiceUnavailable
	case qbt.ErrorCodeUnknown:
		return entities.WorkerErrorCodeUnknown
	default:
		return entities.WorkerErrorCodeWorkerUnreachable
	}
}

// CheckWorkerAvailability checks if the worker is available and accessible
func (r *Repository) CheckWorkerAvailability(worker *entities.Worker) error {
	url := fmt.Sprintf("%s/v1/health/liveness", worker.Address)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		workerErr := classifyWorkerError(err)
		logger.Error("worker availability check failed",
			"worker", worker.Name,
			"address", worker.Address,
			"error_code", workerErr.Code,
			"error", err.Error(),
		)
		return workerErr
	}

	// codeql[go/request-forgery] Intended feature to connect to user-provided worker
	response, err := r.http.Do(req)
	if err != nil {
		workerErr := classifyWorkerError(err)
		logger.Error("worker connection failed",
			"worker", worker.Name,
			"address", worker.Address,
			"error_code", workerErr.Code,
			"error", err.Error(),
		)
		return workerErr
	}

	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		workerErr := classifyHTTPStatusCode(response.StatusCode)
		logger.Error("worker returned error status",
			"worker", worker.Name,
			"address", worker.Address,
			"status_code", response.StatusCode,
			"error_code", workerErr.Code,
		)
		return workerErr
	}

	var handler models.WorkerLivenessResponse
	body, err := io.ReadAll(response.Body)
	if err != nil {
		workerErr := &WorkerError{
			Code:      entities.WorkerErrorCodeUnknown,
			Message:   fmt.Sprintf("failed to read response body: %v", err),
			Permanent: false,
		}
		logger.Error("failed to read worker response",
			"worker", worker.Name,
			"error", err.Error(),
		)
		return workerErr
	}

	if err := json.Unmarshal(body, &handler); err != nil {
		workerErr := &WorkerError{
			Code:      entities.WorkerErrorCodeUnknown,
			Message:   fmt.Sprintf("failed to parse response: %v", err),
			Permanent: false,
		}
		logger.Error("failed to parse worker response",
			"worker", worker.Name,
			"error", err.Error(),
		)
		return workerErr
	}

	result := workercheck.ValidateLiveness(&handler)
	if result.Healthy {
		return nil
	}

	logger.Error("worker liveness check failed",
		"worker", worker.Name,
		"address", worker.Address,
		"error_code", result.ErrorCode,
		"message", result.Message,
		"permanent", result.Permanent,
	)
	return &WorkerError{
		Code:      result.ErrorCode,
		Message:   result.Message,
		Permanent: result.Permanent,
	}
}

// GetInstance retrieves a single instance by its UUID
func (r *Repository) GetInstance(worker *entities.Worker) (*entities.Instance, error) {
	if err := r.isAvailable(worker); err != nil {
		return nil, err
	}

	url := fmt.Sprintf("%s/v1/instance", worker.Address)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	decryptedToken, err := r.crypto.Decrypt(worker.Token)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", decryptedToken))

	// codeql[go/request-forgery] Intended feature to connect to user-provided worker
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

func (r *Repository) GetInstanceWithoutDecrypt(worker *entities.Worker) (*entities.Instance, error) {
	url := fmt.Sprintf("%s/v1/instance", worker.Address)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", worker.Token))

	// codeql[go/request-forgery] Intended feature to connect to user-provided worker
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

func (r *Repository) GetWorkerVersion(worker *entities.Worker) (*entities.WorkerVersion, error) {
	if err := r.isAvailable(worker); err != nil {
		return nil, err
	}

	url := fmt.Sprintf("%s/v1/version", worker.Address)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	decryptedToken, err := r.crypto.Decrypt(worker.Token)
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

	var handler models.WorkerVersionResponse
	body, err := io.ReadAll(response.Body)
	if err != nil {
		return nil, err
	}

	if err := json.NewDecoder(bytes.NewReader(body)).Decode(&handler); err != nil {
		return nil, err
	}

	return mappers.ToWorkerVersion(handler), nil
}

func (r *Repository) GetWorkerTasksStats(worker *entities.Worker) (*entities.TaskStats, error) {
	url := fmt.Sprintf("%s/v1/tasks/stats", worker.Address)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	decryptedToken, err := r.crypto.Decrypt(worker.Token)
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

func (r *Repository) GetWorkerPreferences(worker *entities.Worker) (*entities.InstancePreferences, error) {
	url := fmt.Sprintf("%s/v1/instance/preferences", worker.Address)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	decryptedToken, err := r.crypto.Decrypt(worker.Token)
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

// UpdateWorker updates an existing worker in the database
func (r *Repository) UpdateWorker(ctx context.Context, uid uuid.UUID, updates map[string]interface{}) (*entities.Worker, error) {
	var worker models.Worker

	// First, get the existing worker
	if err := r.db.DB.Where("uuid = ?", uid).First(&worker).Error; err != nil {
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

	// Update the worker
	if err := r.db.DB.Model(&worker).Updates(updates).Error; err != nil {
		return nil, err
	}

	// Get the updated worker
	if err := r.db.DB.Where("uuid = ?", uid).First(&worker).Error; err != nil {
		return nil, err
	}

	return toWorker(worker), nil
}

// DeleteWorker removes a worker from the database by UUID
func (r *Repository) DeleteWorker(uid uuid.UUID) error {
	if err := r.db.DB.Where("uuid = ?", uid).Delete(&models.Worker{}).Error; err != nil {
		return err
	}

	return nil
}

// GetWorkerLogs proxies the logs request to the worker
func (r *Repository) GetWorkerLogs(worker *entities.Worker, normal, info, warning, critical bool, lastKnownID int) ([]*qbt.LogEntry, error) {
	if err := r.isAvailable(worker); err != nil {
		return nil, err
	}

	urlObj, err := url.Parse(fmt.Sprintf("%s/v1/instance/logs", worker.Address))
	if err != nil {
		return nil, err
	}

	query := urlObj.Query()
	query.Set("normal", strconv.FormatBool(normal))
	query.Set("info", strconv.FormatBool(info))
	query.Set("warning", strconv.FormatBool(warning))
	query.Set("critical", strconv.FormatBool(critical))
	if lastKnownID > 0 {
		query.Set("last_known_id", strconv.Itoa(lastKnownID))
	}
	urlObj.RawQuery = query.Encode()

	req, err := http.NewRequest("GET", urlObj.String(), nil)
	if err != nil {
		return nil, err
	}

	decryptedToken, err := r.crypto.Decrypt(worker.Token)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", decryptedToken))

	response, err := r.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to get worker logs, status: %d", response.StatusCode)
	}

	var handler []*qbt.LogEntry
	body, err := io.ReadAll(response.Body)
	if err != nil {
		return nil, err
	}

	if err := json.NewDecoder(bytes.NewReader(body)).Decode(&handler); err != nil {
		return nil, err
	}

	return handler, nil
}

func (r *Repository) ListWorkerTasks(worker *entities.Worker) ([]*entities.Task, error) {
	url := fmt.Sprintf("%s/v1/tasks", worker.Address)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	decryptedToken, err := r.crypto.Decrypt(worker.Token)
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

func (r *Repository) CreateWorkerTask(worker *entities.Worker, schema schemas.TaskCreateSchema) (*entities.Task, error) {
	url := fmt.Sprintf("%s/v1/task", worker.Address)

	payload, err := json.Marshal(schema)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest("POST", url, bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}

	decryptedToken, err := r.crypto.Decrypt(worker.Token)
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

func (r *Repository) DeleteWorkerTask(worker *entities.Worker, id string, purge bool) error {
	baseURL := fmt.Sprintf("%s/v1/task/%s", worker.Address, id)

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

	decryptedToken, err := r.crypto.Decrypt(worker.Token)
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

func (r *Repository) StopWorkerTask(worker *entities.Worker, taskID string) error {
	url := fmt.Sprintf("%s/v1/task/%s/stop", worker.Address, taskID)

	req, err := http.NewRequest("POST", url, nil)
	if err != nil {
		return err
	}

	decryptedToken, err := r.crypto.Decrypt(worker.Token)
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

func (r *Repository) StartWorkerTask(worker *entities.Worker, taskID string) error {
	url := fmt.Sprintf("%s/v1/task/%s/start", worker.Address, taskID)

	req, err := http.NewRequest("POST", url, nil)
	if err != nil {
		return err
	}

	decryptedToken, err := r.crypto.Decrypt(worker.Token)
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

func (r *Repository) ForceDownloadWorkerTask(worker *entities.Worker, taskID string) error {
	url := fmt.Sprintf("%s/v1/task/%s/force_reannounce", worker.Address, taskID)

	req, err := http.NewRequest("POST", url, nil)
	if err != nil {
		return err
	}

	decryptedToken, err := r.crypto.Decrypt(worker.Token)
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

func (r *Repository) GetWorkerTask(worker *entities.Worker, taskID string) (*entities.Task, error) {
	url := fmt.Sprintf("%s/v1/task/%s", worker.Address, taskID)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	decryptedToken, err := r.crypto.Decrypt(worker.Token)
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

func (r *Repository) ForceResumeWorkerTask(worker *entities.Worker, taskID string) error {
	url := fmt.Sprintf("%s/v1/task/%s/force_resume", worker.Address, taskID)

	req, err := http.NewRequest("POST", url, nil)
	if err != nil {
		return err
	}

	decryptedToken, err := r.crypto.Decrypt(worker.Token)
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

func (r *Repository) SetWorkerTaskShareLimit(worker *entities.Worker, taskID string, schema schemas.TaskSetShareLimitSchema) error {
	url := fmt.Sprintf("%s/v1/task/%s/share_limit", worker.Address, taskID)

	payload, err := json.Marshal(schema)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("PUT", url, bytes.NewReader(payload))
	if err != nil {
		return err
	}

	decryptedToken, err := r.crypto.Decrypt(worker.Token)
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

func (r *Repository) SetWorkerTaskLocation(worker *entities.Worker, taskID string, schema schemas.TaskSetLocationSchema) error {
	url := fmt.Sprintf("%s/v1/task/%s/location", worker.Address, taskID)

	payload, err := json.Marshal(schema)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", url, bytes.NewReader(payload))
	if err != nil {
		return err
	}

	decryptedToken, err := r.crypto.Decrypt(worker.Token)
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

func (r *Repository) RenameWorkerTask(worker *entities.Worker, taskID string, schema schemas.TaskRenameSchema) error {
	url := fmt.Sprintf("%s/v1/task/%s/rename", worker.Address, taskID)

	payload, err := json.Marshal(schema)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", url, bytes.NewReader(payload))
	if err != nil {
		return err
	}

	decryptedToken, err := r.crypto.Decrypt(worker.Token)
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

func (r *Repository) SetWorkerTaskSuperSeeding(worker *entities.Worker, taskID string, schema schemas.TaskSuperSeedingSchema) error {
	url := fmt.Sprintf("%s/v1/task/%s/super_seeding", worker.Address, taskID)

	payload, err := json.Marshal(schema)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", url, bytes.NewReader(payload))
	if err != nil {
		return err
	}

	decryptedToken, err := r.crypto.Decrypt(worker.Token)
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

func (r *Repository) ForceRecheckWorkerTask(worker *entities.Worker, taskID string) error {
	url := fmt.Sprintf("%s/v1/task/%s/force_recheck", worker.Address, taskID)

	req, err := http.NewRequest("POST", url, nil)
	if err != nil {
		return err
	}

	decryptedToken, err := r.crypto.Decrypt(worker.Token)
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

func (r *Repository) ForceReannounceWorkerTask(worker *entities.Worker, taskID string) error {
	url := fmt.Sprintf("%s/v1/task/%s/force_reannounce", worker.Address, taskID)

	req, err := http.NewRequest("POST", url, nil)
	if err != nil {
		return err
	}

	decryptedToken, err := r.crypto.Decrypt(worker.Token)
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

func (r *Repository) SetWorkerTaskDownloadLimit(worker *entities.Worker, taskID string, schema schemas.TaskSetDownloadLimitSchema) error {
	url := fmt.Sprintf("%s/v1/task/%s/limit_download_rate", worker.Address, taskID)

	payload, err := json.Marshal(schema)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", url, bytes.NewReader(payload))
	if err != nil {
		return err
	}

	decryptedToken, err := r.crypto.Decrypt(worker.Token)
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

func (r *Repository) SetWorkerTaskUploadLimit(worker *entities.Worker, taskID string, schema schemas.TaskSetUploadLimitSchema) error {
	url := fmt.Sprintf("%s/v1/task/%s/limit_upload_rate", worker.Address, taskID)

	payload, err := json.Marshal(schema)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", url, bytes.NewReader(payload))
	if err != nil {
		return err
	}

	decryptedToken, err := r.crypto.Decrypt(worker.Token)
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

func (r *Repository) ListWorkerTaskFiles(worker *entities.Worker, taskID string) ([]*entities.TaskFile, error) {
	url := fmt.Sprintf("%s/v1/task/%s/files", worker.Address, taskID)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	decryptedToken, err := r.crypto.Decrypt(worker.Token)
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

func (r *Repository) SetWorkerTaskTags(worker *entities.Worker, taskID string, schema schemas.TaskSetTagsSchema) error {
	url := fmt.Sprintf("%s/v1/task/%s/tags", worker.Address, taskID)

	payload, err := json.Marshal(schema)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("PUT", url, bytes.NewReader(payload))
	if err != nil {
		return err
	}

	decryptedToken, err := r.crypto.Decrypt(worker.Token)
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

func (r *Repository) SetWorkerTaskCategory(worker *entities.Worker, taskID string, schema schemas.TaskSetCategorySchema) error {
	url := fmt.Sprintf("%s/v1/task/%s/category", worker.Address, taskID)

	payload, err := json.Marshal(schema)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("PUT", url, bytes.NewReader(payload))
	if err != nil {
		return err
	}

	decryptedToken, err := r.crypto.Decrypt(worker.Token)
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

func (r *Repository) GetWorkerTaskLimits(worker *entities.Worker, taskID string) (*entities.TaskLimits, error) {
	url := fmt.Sprintf("%s/v1/task/%s/limits", worker.Address, taskID)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	decryptedToken, err := r.crypto.Decrypt(worker.Token)
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

func (r *Repository) SetWorkerGlobalSpeedLimits(worker *entities.Worker, schema schemas.InstanceSetSpeedLimitSchema) error {
	url := fmt.Sprintf("%s/v1/instance/speed/limits", worker.Address)

	payload, err := json.Marshal(schema)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", url, bytes.NewReader(payload))
	if err != nil {
		return err
	}

	decryptedToken, err := r.crypto.Decrypt(worker.Token)
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

func (r *Repository) SetWorkerGlobalActiveLimits(worker *entities.Worker, schema schemas.InstanceSetMaxActiveTorrentLimitsSchema) error {
	url := fmt.Sprintf("%s/v1/instance/active/limits", worker.Address)

	payload, err := json.Marshal(schema)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", url, bytes.NewReader(payload))
	if err != nil {
		return err
	}

	decryptedToken, err := r.crypto.Decrypt(worker.Token)
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

func toWorker(item models.Worker) *entities.Worker {
	return &entities.Worker{
		UUID:    item.UUID,
		Name:    item.Name,
		Address: item.Address,
		Token:   item.EncrypetedToken,
		Icon:    item.Icon,
		Color:   item.Color,
	}
}
