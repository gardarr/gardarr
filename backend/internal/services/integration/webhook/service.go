package webhook

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/jfxdev/gardarr/internal/entities"
	"github.com/jfxdev/gardarr/pkg/logger"
)

// Payload represents the webhook POST payload structure
type Payload struct {
	EventID   string                 `json:"event_id"`
	EventType string                 `json:"event_type"`
	AgentID   string                 `json:"agent_id"`
	TaskHash  string                 `json:"task_hash"`
	OldValue  string                 `json:"old_value,omitempty"`
	NewValue  string                 `json:"new_value,omitempty"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
	Timestamp string                 `json:"timestamp"`
}

// Service manages webhook delivery for events
type Service struct {
	webhookURL         string
	insecureSkipVerify bool
	timeoutSeconds     int
	httpClient         *http.Client
	enabled            bool
}

// NewService creates a new webhook service that sends events to the specified URL
func NewService(webhookURL string, insecureSkipVerify bool, timeoutSeconds int) *Service {
	if timeoutSeconds <= 0 {
		timeoutSeconds = 10 // Default timeout
	}

	transport := &http.Transport{
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: insecureSkipVerify,
		},
	}

	return &Service{
		webhookURL:         webhookURL,
		insecureSkipVerify: insecureSkipVerify,
		timeoutSeconds:     timeoutSeconds,
		httpClient: &http.Client{
			Timeout:   time.Duration(timeoutSeconds) * time.Second,
			Transport: transport,
		},
		enabled: true,
	}
}

// SendEvent sends an event to the configured webhook URL
func (s *Service) SendEvent(ctx context.Context, event *entities.Event) error {
	if !s.enabled {
		return nil
	}

	if event == nil {
		return fmt.Errorf("event is nil")
	}

	payload := s.buildPayload(event)

	jsonData, err := json.Marshal(payload)
	if err != nil {
		logger.Error("Failed to marshal webhook payload",
			"service", "webhook",
			"event_id", event.UUID.String(),
			"error", err,
		)
		return fmt.Errorf("failed to marshal payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.webhookURL, bytes.NewBuffer(jsonData))
	if err != nil {
		logger.Error("Failed to create webhook request",
			"service", "webhook",
			"event_id", event.UUID.String(),
			"error", err,
		)
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "Gardarr-Webhook/1.0")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		logger.Error("Failed to send webhook",
			"service", "webhook",
			"event_id", event.UUID.String(),
			"url", s.webhookURL,
			"error", err,
		)
		return fmt.Errorf("failed to send webhook: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		logger.Warn("Webhook returned non-success status",
			"service", "webhook",
			"event_id", event.UUID.String(),
			"status_code", resp.StatusCode,
			"url", s.webhookURL,
		)
		return fmt.Errorf("webhook returned status %d", resp.StatusCode)
	}

	logger.Debug("Webhook sent successfully",
		"service", "webhook",
		"event_id", event.UUID.String(),
		"event_type", event.Type,
		"status_code", resp.StatusCode,
	)

	return nil
}

// buildPayload converts an Event entity to a webhook Payload
func (s *Service) buildPayload(event *entities.Event) *Payload {
	return &Payload{
		EventID:   event.UUID.String(),
		EventType: event.Type,
		AgentID:   event.AgentID.String(),
		TaskHash:  event.TaskHash,
		OldValue:  event.OldValue,
		NewValue:  event.NewValue,
		Metadata:  event.Metadata,
		Timestamp: event.CreatedAt.Format(time.RFC3339),
	}
}

// SetEnabled enables or disables the webhook service
func (s *Service) SetEnabled(enabled bool) {
	s.enabled = enabled
}

// Enabled returns whether the webhook service is enabled
func (s *Service) Enabled() bool {
	return s.enabled
}
