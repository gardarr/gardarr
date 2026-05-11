package task_metadata

import (
	"context"
	"fmt"

	integrationService "github.com/jfxdev/gardarr/internal/services/integration"
	"github.com/jfxdev/gardarr/internal/services/tgdb"
)

type MetadataProviderSearchResult struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	ReleaseDate string `json:"release_date,omitempty"`
	Description string `json:"description,omitempty"`
	ImageURL    string `json:"image_url,omitempty"`
}

type MetadataProviderStatus struct {
	Provider string `json:"provider"`
	Active   bool   `json:"active"`
}

type MetadataProvider interface {
	Name() string
	Status(ctx context.Context) (*MetadataProviderStatus, error)
	Search(ctx context.Context, query string) ([]MetadataProviderSearchResult, error)
}

type MetadataProviderRegistry struct {
	providers map[string]MetadataProvider
}

func NewMetadataProviderRegistry(providers ...MetadataProvider) *MetadataProviderRegistry {
	registry := &MetadataProviderRegistry{
		providers: make(map[string]MetadataProvider, len(providers)),
	}

	for _, provider := range providers {
		registry.providers[provider.Name()] = provider
	}

	return registry
}

func (r *MetadataProviderRegistry) Get(provider string) (MetadataProvider, bool) {
	result, ok := r.providers[provider]
	return result, ok
}

type TGDBMetadataProvider struct {
	configService *integrationService.ProviderConfigService
}

func NewTGDBMetadataProvider(configService *integrationService.ProviderConfigService) *TGDBMetadataProvider {
	return &TGDBMetadataProvider{configService: configService}
}

func (p *TGDBMetadataProvider) Name() string {
	return integrationService.MetadataSourceTGDB
}

func (p *TGDBMetadataProvider) Status(ctx context.Context) (*MetadataProviderStatus, error) {
	key, err := p.configService.GetDecryptedAPIKey(ctx, p.Name())
	if err != nil {
		return nil, err
	}

	return &MetadataProviderStatus{
		Provider: p.Name(),
		Active:   key != "",
	}, nil
}

func (p *TGDBMetadataProvider) Search(ctx context.Context, query string) ([]MetadataProviderSearchResult, error) {
	key, err := p.configService.GetDecryptedAPIKey(ctx, p.Name())
	if err != nil {
		return nil, err
	}
	if key == "" {
		return nil, fmt.Errorf("provider is not active")
	}

	client := tgdb.NewClient(key)
	results, err := client.SearchGames(query)
	if err != nil {
		return nil, err
	}

	items := make([]MetadataProviderSearchResult, 0, len(results.Data.Games))
	for _, game := range results.Data.Games {
		imageURL := ""
		if boxarts, ok := results.Include.Boxart.Data[fmt.Sprintf("%d", game.ID)]; ok && len(boxarts) > 0 {
			imageURL = fmt.Sprintf("%s%s", results.Include.Boxart.BaseURL.Large, boxarts[0].Filename)
			for _, boxart := range boxarts {
				if boxart.Side == "front" {
					imageURL = fmt.Sprintf("%s%s", results.Include.Boxart.BaseURL.Large, boxart.Filename)
					break
				}
			}
		}

		items = append(items, MetadataProviderSearchResult{
			ID:          fmt.Sprintf("%d", game.ID),
			Title:       game.GameTitle,
			ReleaseDate: game.ReleaseDate,
			Description: game.Overview,
			ImageURL:    imageURL,
		})
	}

	return items, nil
}
