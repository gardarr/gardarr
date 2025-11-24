package webhook

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/jfxdev/gardarr/internal/entities"
	"github.com/jfxdev/gardarr/internal/infra/database"
	"github.com/jfxdev/gardarr/internal/models"
)

func TestRepositoryCreateWebhook(t *testing.T) {
	db := database.SetupTestDBWithMigrations(t)
	repo := NewRepository(db)
	ctx := context.Background()

	webhook := entities.Webhook{
		UUID:               uuid.New(),
		URL:                "https://example.com/webhook",
		InsecureSkipVerify: false,
		Enabled:            true,
		TimeoutSeconds:     30,
	}

	created, err := repo.CreateWebhook(ctx, webhook)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if created == nil {
		t.Fatal("Expected created webhook, got nil")
	}

	if created.UUID == uuid.Nil {
		t.Error("Expected UUID to be set")
	}

	if created.URL != webhook.URL {
		t.Errorf("Expected URL %s, got %s", webhook.URL, created.URL)
	}

	if created.InsecureSkipVerify != webhook.InsecureSkipVerify {
		t.Errorf("Expected InsecureSkipVerify %v, got %v", webhook.InsecureSkipVerify, created.InsecureSkipVerify)
	}

	if created.Enabled != webhook.Enabled {
		t.Errorf("Expected Enabled %v, got %v", webhook.Enabled, created.Enabled)
	}

	if created.TimeoutSeconds != webhook.TimeoutSeconds {
		t.Errorf("Expected TimeoutSeconds %d, got %d", webhook.TimeoutSeconds, created.TimeoutSeconds)
	}
}

func TestRepositoryListWebhooks(t *testing.T) {
	db := database.SetupTestDBWithMigrations(t)
	repo := NewRepository(db)
	ctx := context.Background()

	// Test empty list
	webhooks, err := repo.ListWebhooks(ctx)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if len(webhooks) != 0 {
		t.Errorf("Expected 0 webhooks, got %d", len(webhooks))
	}

	// Create test webhooks
	testWebhooks := []entities.Webhook{
		{UUID: uuid.New(), URL: "https://example.com/webhook1", InsecureSkipVerify: false, Enabled: true, TimeoutSeconds: 10},
		{UUID: uuid.New(), URL: "https://example.com/webhook2", InsecureSkipVerify: true, Enabled: true, TimeoutSeconds: 20},
		{UUID: uuid.New(), URL: "https://example.com/webhook3", InsecureSkipVerify: false, Enabled: false, TimeoutSeconds: 30},
	}

	for _, wh := range testWebhooks {
		_, err := repo.CreateWebhook(ctx, wh)
		if err != nil {
			t.Fatalf("Failed to create webhook: %v", err)
		}
	}

	// List all webhooks
	webhooks, err = repo.ListWebhooks(ctx)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if len(webhooks) != len(testWebhooks) {
		t.Errorf("Expected %d webhooks, got %d", len(testWebhooks), len(webhooks))
	}
}

func TestRepositoryListEnabledWebhooks(t *testing.T) {
	db := database.SetupTestDBWithMigrations(t)
	repo := NewRepository(db)
	ctx := context.Background()

	// Create test webhooks (2 enabled, 1 disabled)
	testWebhooks := []entities.Webhook{
		{UUID: uuid.New(), URL: "https://example.com/webhook1", Enabled: true, TimeoutSeconds: 10},
		{UUID: uuid.New(), URL: "https://example.com/webhook2", Enabled: true, TimeoutSeconds: 15},
		{UUID: uuid.New(), URL: "https://example.com/webhook3", Enabled: false, TimeoutSeconds: 20},
	}

	for _, wh := range testWebhooks {
		_, err := repo.CreateWebhook(ctx, wh)
		if err != nil {
			t.Fatalf("Failed to create webhook: %v", err)
		}
	}

	// List only enabled webhooks
	webhooks, err := repo.ListEnabledWebhooks(ctx)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if len(webhooks) != 2 {
		t.Errorf("Expected 2 enabled webhooks, got %d", len(webhooks))
	}

	// Verify all returned webhooks are enabled
	for _, wh := range webhooks {
		if !wh.Enabled {
			t.Error("Expected only enabled webhooks in result")
		}
	}
}

func TestRepositoryGetWebhookByUUID(t *testing.T) {
	db := database.SetupTestDBWithMigrations(t)
	repo := NewRepository(db)
	ctx := context.Background()

	// Create a webhook
	webhook := entities.Webhook{
		UUID:               uuid.New(),
		URL:                "https://example.com/test",
		InsecureSkipVerify: true,
		Enabled:            true,
		TimeoutSeconds:     25,
	}

	created, err := repo.CreateWebhook(ctx, webhook)
	if err != nil {
		t.Fatalf("Failed to create webhook: %v", err)
	}

	// Get by UUID
	retrieved, err := repo.GetWebhookByUUID(ctx, created.UUID)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if retrieved.UUID != created.UUID {
		t.Errorf("Expected UUID %s, got %s", created.UUID, retrieved.UUID)
	}

	if retrieved.URL != created.URL {
		t.Errorf("Expected URL %s, got %s", created.URL, retrieved.URL)
	}

	if retrieved.InsecureSkipVerify != created.InsecureSkipVerify {
		t.Errorf("Expected InsecureSkipVerify %v, got %v", created.InsecureSkipVerify, retrieved.InsecureSkipVerify)
	}

	// Test non-existent UUID
	_, err = repo.GetWebhookByUUID(ctx, uuid.New())
	if err == nil {
		t.Error("Expected error for non-existent UUID, got nil")
	}
}

func TestRepositoryUpdateWebhook(t *testing.T) {
	db := database.SetupTestDBWithMigrations(t)
	repo := NewRepository(db)
	ctx := context.Background()

	// Create a webhook
	webhook := entities.Webhook{
		UUID:               uuid.New(),
		URL:                "https://example.com/original",
		InsecureSkipVerify: false,
		Enabled:            true,
		TimeoutSeconds:     10,
	}

	created, err := repo.CreateWebhook(ctx, webhook)
	if err != nil {
		t.Fatalf("Failed to create webhook: %v", err)
	}

	// Update the webhook
	created.URL = "https://example.com/updated"
	created.InsecureSkipVerify = true
	created.Enabled = false
	created.TimeoutSeconds = 60

	updated, err := repo.UpdateWebhook(ctx, *created)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if updated.URL != "https://example.com/updated" {
		t.Errorf("Expected URL 'https://example.com/updated', got %s", updated.URL)
	}

	if updated.InsecureSkipVerify != true {
		t.Errorf("Expected InsecureSkipVerify true, got %v", updated.InsecureSkipVerify)
	}

	if updated.Enabled != false {
		t.Errorf("Expected Enabled false, got %v", updated.Enabled)
	}

	if updated.TimeoutSeconds != 60 {
		t.Errorf("Expected TimeoutSeconds 60, got %d", updated.TimeoutSeconds)
	}

	// Test update non-existent webhook
	nonExistent := entities.Webhook{
		UUID: uuid.New(),
		URL:  "https://example.com/test",
	}
	_, err = repo.UpdateWebhook(ctx, nonExistent)
	if err == nil {
		t.Error("Expected error for non-existent webhook update, got nil")
	}
}

func TestRepositoryDeleteWebhook(t *testing.T) {
	db := database.SetupTestDBWithMigrations(t)
	repo := NewRepository(db)
	ctx := context.Background()

	// Create a webhook
	webhook := entities.Webhook{
		UUID:           uuid.New(),
		URL:            "https://example.com/delete",
		Enabled:        true,
		TimeoutSeconds: 15,
	}

	created, err := repo.CreateWebhook(ctx, webhook)
	if err != nil {
		t.Fatalf("Failed to create webhook: %v", err)
	}

	// Delete the webhook
	err = repo.DeleteWebhook(ctx, created.UUID)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	// Verify deletion
	_, err = repo.GetWebhookByUUID(ctx, created.UUID)
	if err == nil {
		t.Error("Expected error when retrieving deleted webhook, got nil")
	}

	// Test delete non-existent webhook
	err = repo.DeleteWebhook(ctx, uuid.New())
	if err == nil {
		t.Error("Expected error for non-existent webhook deletion, got nil")
	}
}

func TestRepositoryToWebhookConversion(t *testing.T) {
	id := uuid.New()
	model := models.Webhook{
		UUID:               id,
		URL:                "https://example.com/test",
		InsecureSkipVerify: true,
		Enabled:            false,
		TimeoutSeconds:     45,
	}

	entity := toWebhook(model)

	if entity.UUID != model.UUID {
		t.Errorf("Expected UUID %s, got %s", model.UUID, entity.UUID)
	}

	if entity.URL != model.URL {
		t.Errorf("Expected URL %s, got %s", model.URL, entity.URL)
	}

	if entity.InsecureSkipVerify != model.InsecureSkipVerify {
		t.Errorf("Expected InsecureSkipVerify %v, got %v", model.InsecureSkipVerify, entity.InsecureSkipVerify)
	}

	if entity.Enabled != model.Enabled {
		t.Errorf("Expected Enabled %v, got %v", model.Enabled, entity.Enabled)
	}

	if entity.TimeoutSeconds != model.TimeoutSeconds {
		t.Errorf("Expected TimeoutSeconds %d, got %d", model.TimeoutSeconds, entity.TimeoutSeconds)
	}
}
