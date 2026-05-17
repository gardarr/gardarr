package tgdb

import (
	"context"
	"encoding/base64"
	"testing"

	"github.com/jfxdev/gardarr/internal/infra/database"
	"github.com/jfxdev/gardarr/internal/models"
	cryptoService "github.com/jfxdev/gardarr/internal/services/crypto"
	integrationService "github.com/jfxdev/gardarr/internal/services/integration"
	tgdbclient "github.com/jfxdev/gardarr/internal/services/tgdb"
	"github.com/jfxdev/gardarr/pkg/gen"
)

func setupTGDBProvider(t *testing.T) *MetadataProvider {
	t.Helper()

	password, err := gen.GeneratePassword(32)
	if err != nil {
		t.Fatalf("failed to generate test encryption key: %v", err)
	}
	t.Setenv("ENCRYPTION_KEY", base64.StdEncoding.EncodeToString([]byte(password)))

	cryptoSvc, err := cryptoService.NewCryptoService()
	if err != nil {
		t.Fatalf("failed to create crypto service: %v", err)
	}

	db := database.SetupTestDB(t, &models.IntegrationProviderConfig{})
	configSvc := integrationService.NewProviderConfigService(db, cryptoSvc)

	if _, err := configSvc.UpdateProvider(context.Background(), integrationService.MetadataSourceTGDB, true, "provider-key"); err != nil {
		t.Fatalf("failed to seed provider config: %v", err)
	}

	return NewMetadataProvider(configSvc)
}

func TestMetadataProviderStatus(t *testing.T) {
	provider := setupTGDBProvider(t)

	status, err := provider.Status(context.Background())
	if err != nil {
		t.Fatalf("Status failed: %v", err)
	}

	if !status.Active {
		t.Error("expected TGDB provider to be active")
	}
}

func TestSelectImageURLPrefersFrontBoxart(t *testing.T) {
	boxart := tgdbclient.BoxartData{}
	boxart.BaseURL.Large = "https://cdn.thegamesdb.net/images/large/"
	boxart.Data = map[string][]tgdbclient.BoxartImage{
		"123": {
			{Side: "back", Filename: "back.jpg"},
			{Side: "front", Filename: "front.jpg"},
		},
	}

	imageURL := selectImageURL(123, boxart)

	if imageURL != "https://cdn.thegamesdb.net/images/large/front.jpg" {
		t.Fatalf("expected front image URL, got %s", imageURL)
	}
}

func TestSelectImageURLFallsBackToFirstBoxart(t *testing.T) {
	boxart := tgdbclient.BoxartData{}
	boxart.BaseURL.Large = "https://cdn.thegamesdb.net/images/large/"
	boxart.Data = map[string][]tgdbclient.BoxartImage{
		"123": {
			{Side: "back", Filename: "back.jpg"},
			{Side: "side", Filename: "side.jpg"},
		},
	}

	imageURL := selectImageURL(123, boxart)

	if imageURL != "https://cdn.thegamesdb.net/images/large/back.jpg" {
		t.Fatalf("expected first image URL, got %s", imageURL)
	}
}

func TestSelectImageURLReturnsEmptyWhenNoBoxartExists(t *testing.T) {
	boxart := tgdbclient.BoxartData{}
	boxart.BaseURL.Large = "https://cdn.thegamesdb.net/images/large/"
	boxart.Data = map[string][]tgdbclient.BoxartImage{}

	imageURL := selectImageURL(123, boxart)

	if imageURL != "" {
		t.Fatalf("expected empty image URL, got %s", imageURL)
	}
}

func TestBuildSelectionMapsGameFields(t *testing.T) {
	boxart := tgdbclient.BoxartData{}
	boxart.BaseURL.Large = "https://cdn.thegamesdb.net/images/large/"
	boxart.Data = map[string][]tgdbclient.BoxartImage{
		"123": {{Side: "front", Filename: "front.jpg"}},
	}

	selection := buildSelection(tgdbclient.GameResult{
		ID:          123,
		GameTitle:   "Test Game",
		ReleaseDate: "2024-01-01",
		Overview:    "Overview",
	}, boxart)

	if selection.ID != "123" || selection.Title != "Test Game" || selection.Description != "Overview" {
		t.Fatalf("unexpected selection: %#v", selection)
	}
	if selection.ImageID != "front.jpg" {
		t.Fatalf("unexpected image ID: %s", selection.ImageID)
	}
	if selection.ImageURL != "https://cdn.thegamesdb.net/images/large/front.jpg" {
		t.Fatalf("unexpected image URL: %s", selection.ImageURL)
	}
}

func TestMetadataProviderBuildImageURL(t *testing.T) {
	provider := setupTGDBProvider(t)

	imageURL, err := provider.BuildImageURL("boxart/front.jpg")
	if err != nil {
		t.Fatalf("BuildImageURL failed: %v", err)
	}
	if imageURL != "https://cdn.thegamesdb.net/images/large/boxart/front.jpg" {
		t.Fatalf("unexpected image URL: %s", imageURL)
	}
}

func TestMetadataProviderAllowedImageHosts(t *testing.T) {
	provider := setupTGDBProvider(t)

	hosts := provider.AllowedImageHosts()

	if len(hosts) != 1 || hosts[0] != "cdn.thegamesdb.net" {
		t.Fatalf("unexpected allowed image hosts: %#v", hosts)
	}
}
