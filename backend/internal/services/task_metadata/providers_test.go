package task_metadata

import (
	"context"
	"os"
	"testing"

	"github.com/jfxdev/gardarr/internal/infra/database"
	"github.com/jfxdev/gardarr/internal/models"
	cryptoService "github.com/jfxdev/gardarr/internal/services/crypto"
	integrationService "github.com/jfxdev/gardarr/internal/services/integration"
)

const providersTestEncryptionKey = "MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI="

func setupTGDBProvider(t *testing.T) *TGDBMetadataProvider {
	t.Helper()
	os.Setenv("ENCRYPTION_KEY", providersTestEncryptionKey)

	cryptoSvc, err := cryptoService.NewCryptoService()
	if err != nil {
		t.Fatalf("failed to create crypto service: %v", err)
	}

	db := database.SetupTestDB(t, &models.IntegrationProviderConfig{})
	configSvc := integrationService.NewProviderConfigService(db, cryptoSvc)

	if _, err := configSvc.UpdateProvider(context.Background(), integrationService.MetadataSourceTGDB, true, "provider-key"); err != nil {
		t.Fatalf("failed to seed provider config: %v", err)
	}

	return NewTGDBMetadataProvider(configSvc)
}

func TestMetadataProviderRegistryGet(t *testing.T) {
	provider := setupTGDBProvider(t)
	registry := NewMetadataProviderRegistry(provider)

	resolved, ok := registry.Get(integrationService.MetadataSourceTGDB)
	if !ok {
		t.Fatal("expected TGDB provider to be registered")
	}

	if resolved.Name() != integrationService.MetadataSourceTGDB {
		t.Errorf("expected provider name %q, got %q", integrationService.MetadataSourceTGDB, resolved.Name())
	}
}

func TestTGDBMetadataProviderStatus(t *testing.T) {
	provider := setupTGDBProvider(t)

	status, err := provider.Status(context.Background())
	if err != nil {
		t.Fatalf("Status failed: %v", err)
	}

	if !status.Active {
		t.Error("expected TGDB provider to be active")
	}
}
