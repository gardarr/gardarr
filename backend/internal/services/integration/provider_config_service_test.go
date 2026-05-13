package integration

import (
	"context"
	"os"
	"testing"

	"github.com/jfxdev/gardarr/internal/infra/database"
	"github.com/jfxdev/gardarr/internal/models"
	cryptoService "github.com/jfxdev/gardarr/internal/services/crypto"
)

const testEncryptionKey = "MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI="

func setupProviderConfigService(t *testing.T) *ProviderConfigService {
	t.Helper()
	os.Setenv("ENCRYPTION_KEY", testEncryptionKey)

	cryptoSvc, err := cryptoService.NewCryptoService()
	if err != nil {
		t.Fatalf("failed to create crypto service: %v", err)
	}

	db := database.SetupTestDB(t, &models.IntegrationProviderConfig{})
	return NewProviderConfigService(db, cryptoSvc)
}

func TestProviderConfigServiceBootstrapTGDBFromEnv(t *testing.T) {
	ctx := context.Background()
	svc := setupProviderConfigService(t)
	os.Setenv("TGDB_KEY", "bootstrap-key")

	if err := svc.BootstrapTGDBFromEnv(ctx); err != nil {
		t.Fatalf("BootstrapTGDBFromEnv failed: %v", err)
	}

	summary, err := svc.GetSummary(ctx, MetadataSourceTGDB)
	if err != nil {
		t.Fatalf("GetSummary failed: %v", err)
	}

	if !summary.Enabled {
		t.Error("expected TGDB integration to be enabled after bootstrap")
	}

	if !summary.APIKeyConfigured {
		t.Error("expected TGDB API key to be configured after bootstrap")
	}
}

func TestProviderConfigServiceUpdateAndDecrypt(t *testing.T) {
	ctx := context.Background()
	svc := setupProviderConfigService(t)

	summary, err := svc.UpdateProvider(ctx, MetadataSourceTGDB, true, "test-key")
	if err != nil {
		t.Fatalf("UpdateProvider failed: %v", err)
	}

	if !summary.Enabled {
		t.Error("expected TGDB integration to be enabled")
	}

	if !summary.APIKeyConfigured {
		t.Error("expected TGDB API key to be configured")
	}

	apiKey, err := svc.GetDecryptedAPIKey(ctx, MetadataSourceTGDB)
	if err != nil {
		t.Fatalf("GetDecryptedAPIKey failed: %v", err)
	}

	if apiKey != "test-key" {
		t.Errorf("expected decrypted API key 'test-key', got %q", apiKey)
	}
}
