package tgdb

import (
	"context"
	"fmt"
	"strings"

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
	client, err := p.client(ctx)
	if err != nil {
		return nil, err
	}
	results, err := client.SearchGames(ctx, query)
	if err != nil {
		return nil, err
	}

	items := make([]taskmetadata.MetadataProviderSearchResult, 0, len(results.Data.Games))
	for _, game := range results.Data.Games {
		selection := buildSelection(game, results.Include.Boxart)

		items = append(items, taskmetadata.MetadataProviderSearchResult{
			ID:          selection.ID,
			Title:       selection.Title,
			ReleaseDate: selection.ReleaseDate,
			Description: selection.Description,
			ImageID:     selection.ImageID,
			ImageURL:    selection.ImageURL,
		})
	}

	return items, nil
}

func (p *MetadataProvider) Resolve(ctx context.Context, id string) (*taskmetadata.MetadataProviderSelection, error) {
	client, err := p.client(ctx)
	if err != nil {
		return nil, err
	}

	results, err := client.GetGameByID(ctx, id)
	if err != nil {
		return nil, err
	}

	if results == nil || len(results.Data.Games) == 0 {
		return nil, taskmetadata.ErrProviderSelectionNotFound
	}

	return buildSelection(results.Data.Games[0], results.Include.Boxart), nil
}

func (p *MetadataProvider) AllowedImageHosts() []string {
	return []string{"cdn.thegamesdb.net"}
}

func (p *MetadataProvider) BuildImageURL(imageID string) (string, error) {
	return buildImageURL(imageID, "https://cdn.thegamesdb.net/images/large/")
}

func buildImageURL(imageID, baseURL string) (string, error) {
	trimmedImageID := strings.TrimSpace(imageID)
	if trimmedImageID == "" {
		return "", nil
	}
	if strings.Contains(trimmedImageID, "://") || strings.HasPrefix(trimmedImageID, "/") {
		return "", fmt.Errorf("invalid image id")
	}

	return fmt.Sprintf("%s%s", baseURL, trimmedImageID), nil
}

func (p *MetadataProvider) client(ctx context.Context) (*tgdbclient.Client, error) {
	key, err := p.configService.GetDecryptedAPIKey(ctx, p.Name())
	if err != nil {
		return nil, err
	}
	if key == "" {
		return nil, fmt.Errorf("provider is not active")
	}

	return tgdbclient.NewClient(key), nil
}

func buildSelection(game tgdbclient.GameResult, boxart tgdbclient.BoxartData) *taskmetadata.MetadataProviderSelection {
	return &taskmetadata.MetadataProviderSelection{
		ID:          fmt.Sprintf("%d", game.ID),
		Title:       game.GameTitle,
		ReleaseDate: game.ReleaseDate,
		Description: game.Overview,
		ImageID:     selectImageID(game.ID, boxart),
		ImageURL:    selectImageURL(game.ID, boxart),
	}
}

func selectImageID(gameID int, boxart tgdbclient.BoxartData) string {
	boxarts, ok := boxart.Data[fmt.Sprintf("%d", gameID)]
	if !ok || len(boxarts) == 0 {
		return ""
	}

	selected := boxarts[0]
	for _, candidate := range boxarts {
		if candidate.Side == "front" {
			selected = candidate
			break
		}
	}

	return strings.TrimPrefix(selected.Filename, "/")
}

func selectImageURL(gameID int, boxart tgdbclient.BoxartData) string {
	imageID := selectImageID(gameID, boxart)
	if imageID == "" {
		return ""
	}

	imageURL, err := buildImageURL(imageID, boxart.BaseURL.Large)
	if err != nil {
		return ""
	}

	return imageURL
}
