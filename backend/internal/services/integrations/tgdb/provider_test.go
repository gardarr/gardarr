package tgdb

import (
	"context"
	"encoding/base64"
	"testing"

	"github.com/jfxdev/gardarr/internal/infra/database"
	"github.com/jfxdev/gardarr/internal/models"
	cryptoService "github.com/jfxdev/gardarr/internal/services/crypto"
	integrationService "github.com/jfxdev/gardarr/internal/services/integration"
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
