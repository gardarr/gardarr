package tgdb

import (
	"context"
	"fmt"

	integrationService "github.com/jfxdev/gardarr/internal/services/integration"
	taskmetadata "github.com/jfxdev/gardarr/internal/services/task_metadata"
	tgdbclient "github.com/jfxdev/gardarr/internal/services/tgdb"
)

type MetadataProvider struct {
	configService *integrationService.ProviderConfigService
}

func NewMetadataProvider(configService *integrationService.ProviderConfigService) *MetadataProvider {
	return &MetadataProvider{configService: configService}
}

func (p *MetadataProvider) Name() string {
	return integrationService.MetadataSourceTGDB
}

func (p *MetadataProvider) Status(ctx context.Context) (*taskmetadata.MetadataProviderStatus, error) {
	key, err := p.configService.GetDecryptedAPIKey(ctx, p.Name())
	if err != nil {
		return nil, err
	}

	return &taskmetadata.MetadataProviderStatus{
		Provider: p.Name(),
		Active:   key != "",
	}, nil
}

func (p *MetadataProvider) Search(ctx context.Context, query string) ([]taskmetadata.MetadataProviderSearchResult, error) {
	key, err := p.configService.GetDecryptedAPIKey(ctx, p.Name())
	if err != nil {
		return nil, err
	}
	if key == "" {
		return nil, fmt.Errorf("provider is not active")
	}

	client := tgdbclient.NewClient(key)
	results, err := client.SearchGames(ctx, query)
	if err != nil {
		return nil, err
	}

	items := make([]taskmetadata.MetadataProviderSearchResult, 0, len(results.Data.Games))
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

		items = append(items, taskmetadata.MetadataProviderSearchResult{
			ID:          fmt.Sprintf("%d", game.ID),
			Title:       game.GameTitle,
			ReleaseDate: game.ReleaseDate,
			Description: game.Overview,
			ImageURL:    imageURL,
		})
	}

	return items, nil
}

func (p *MetadataProvider) AllowedImageHosts() []string {
	return []string{"cdn.thegamesdb.net"}
}
