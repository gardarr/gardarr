package integration

import (
	"context"
	"os"
	"strings"

	"github.com/jfxdev/gardarr/internal/entities"
	"github.com/jfxdev/gardarr/internal/infra/database"
	integrationProviderConfigRepo "github.com/jfxdev/gardarr/internal/repository/integration_provider_config"
	cryptoService "github.com/jfxdev/gardarr/internal/services/crypto"
)

const (
	MetadataSourceNone = "none"
	MetadataSourceTGDB = "tgdb"
	MetadataSourceTMDB = "tmdb"
)

type ProviderConfigService struct {
	repository *integrationProviderConfigRepo.Repository
	crypto     *cryptoService.CryptoService
}

func NewProviderConfigService(db *database.Database, crypto *cryptoService.CryptoService) *ProviderConfigService {
	return &ProviderConfigService{
		repository: integrationProviderConfigRepo.NewRepository(db),
		crypto:     crypto,
	}
}

func (s *ProviderConfigService) BootstrapTGDBFromEnv(ctx context.Context) error {
	envKey := strings.TrimSpace(os.Getenv("TGDB_KEY"))
	if envKey == "" {
		return nil
	}

	existing, err := s.repository.GetByProvider(ctx, MetadataSourceTGDB)
	if err == nil {
		if existing.EncryptedAPIKey != "" || existing.Enabled {
			return nil
		}
	} else if err != integrationProviderConfigRepo.ErrNotFound {
		return err
	}

	encrypted, err := s.crypto.Encrypt(envKey)
	if err != nil {
		return err
	}

	_, err = s.repository.Upsert(ctx, entities.IntegrationProviderConfig{
		Provider:        MetadataSourceTGDB,
		Enabled:         true,
		EncryptedAPIKey: encrypted,
	})
	return err
}

func (s *ProviderConfigService) GetSummary(ctx context.Context, provider string) (*entities.IntegrationProviderConfigSummary, error) {
	cfg, err := s.repository.GetByProvider(ctx, provider)
	if err == integrationProviderConfigRepo.ErrNotFound {
		return &entities.IntegrationProviderConfigSummary{
			Provider:         provider,
			Enabled:          false,
			APIKeyConfigured: false,
		}, nil
	}
	if err != nil {
		return nil, err
	}

	return &entities.IntegrationProviderConfigSummary{
		Provider:         cfg.Provider,
		Enabled:          cfg.Enabled,
		APIKeyConfigured: cfg.EncryptedAPIKey != "",
		UpdatedAt:        cfg.UpdatedAt,
	}, nil
}

func (s *ProviderConfigService) UpdateProvider(ctx context.Context, provider string, enabled bool, apiKey string) (*entities.IntegrationProviderConfigSummary, error) {
	existing, err := s.repository.GetByProvider(ctx, provider)
	if err != nil && err != integrationProviderConfigRepo.ErrNotFound {
		return nil, err
	}

	encryptedAPIKey := ""
	if existing != nil {
		encryptedAPIKey = existing.EncryptedAPIKey
	}

	if strings.TrimSpace(apiKey) != "" {
		encryptedAPIKey, err = s.crypto.Encrypt(strings.TrimSpace(apiKey))
		if err != nil {
			return nil, err
		}
	}

	cfg := entities.IntegrationProviderConfig{
		Provider:        provider,
		Enabled:         enabled,
		EncryptedAPIKey: encryptedAPIKey,
	}

	if _, err := s.repository.Upsert(ctx, cfg); err != nil {
		return nil, err
	}

	return s.GetSummary(ctx, provider)
}

func (s *ProviderConfigService) GetDecryptedAPIKey(ctx context.Context, provider string) (string, error) {
	cfg, err := s.repository.GetByProvider(ctx, provider)
	if err != nil {
		if err == integrationProviderConfigRepo.ErrNotFound {
			return "", nil
		}
		return "", err
	}

	if !cfg.Enabled || cfg.EncryptedAPIKey == "" {
		return "", nil
	}

	return s.crypto.Decrypt(cfg.EncryptedAPIKey)
}
