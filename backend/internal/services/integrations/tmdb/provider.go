package tmdb

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	integrationService "github.com/jfxdev/gardarr/internal/services/integration"
	taskmetadata "github.com/jfxdev/gardarr/internal/services/task_metadata"
	tmdbclient "github.com/jfxdev/gardarr/internal/services/tmdb"
)

type MetadataProvider struct {
	configService *integrationService.ProviderConfigService
}

func NewMetadataProvider(configService *integrationService.ProviderConfigService) *MetadataProvider {
	return &MetadataProvider{configService: configService}
}

func (p *MetadataProvider) Name() string {
	return integrationService.MetadataSourceTMDB
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

	results, err := client.SearchMulti(ctx, query)
	if err != nil {
		return nil, err
	}

	items := make([]taskmetadata.MetadataProviderSearchResult, 0, len(results.Results))
	for _, result := range results.Results {
		if result.MediaType != "movie" && result.MediaType != "tv" {
			continue
		}

		selection := buildSelection(result)
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
	mediaType, tmdbID, err := parseCompositeID(id)
	if err != nil {
		return nil, taskmetadata.ErrProviderSelectionNotFound
	}

	client, err := p.client(ctx)
	if err != nil {
		return nil, err
	}

	result, err := client.GetByID(ctx, mediaType, tmdbID)
	if err != nil {
		return nil, err
	}
	if result == nil {
		return nil, taskmetadata.ErrProviderSelectionNotFound
	}

	return buildSelection(*result), nil
}

func (p *MetadataProvider) AllowedImageHosts() []string {
	return []string{"image.tmdb.org"}
}

func (p *MetadataProvider) BuildImageURL(imageID string) (string, error) {
	trimmed := strings.TrimSpace(imageID)
	if trimmed == "" {
		return "", nil
	}
	trimmed = strings.TrimPrefix(trimmed, "/")
	if strings.Contains(trimmed, "://") || strings.Contains(trimmed, "/") {
		return "", fmt.Errorf("invalid image id")
	}

	return fmt.Sprintf("https://image.tmdb.org/t/p/original/%s", trimmed), nil
}

func (p *MetadataProvider) client(ctx context.Context) (*tmdbclient.Client, error) {
	key, err := p.configService.GetDecryptedAPIKey(ctx, p.Name())
	if err != nil {
		return nil, err
	}
	if key == "" {
		return nil, fmt.Errorf("provider is not active")
	}

	return tmdbclient.NewClient(key), nil
}

// buildSelection maps a TMDB search/detail result into a provider selection.
// The selection ID encodes the media type ("movie"/"tv") alongside the TMDB
// numeric ID, since movie and TV IDs are not unique across TMDB's namespaces
// and Resolve needs the media type to fetch the right endpoint.
func buildSelection(result tmdbclient.SearchResult) *taskmetadata.MetadataProviderSelection {
	title := result.Title
	releaseDate := result.ReleaseDate
	if result.MediaType == "tv" {
		title = result.Name
		releaseDate = result.FirstAirDate
	}

	imageID := strings.TrimPrefix(result.PosterPath, "/")

	return &taskmetadata.MetadataProviderSelection{
		ID:          buildCompositeID(result.MediaType, result.ID),
		Title:       title,
		ReleaseDate: releaseDate,
		Description: result.Overview,
		ImageID:     imageID,
		ImageURL:    selectImageURL(imageID),
	}
}

func selectImageURL(imageID string) string {
	if imageID == "" {
		return ""
	}
	return fmt.Sprintf("https://image.tmdb.org/t/p/w500/%s", imageID)
}

func buildCompositeID(mediaType string, id int) string {
	return fmt.Sprintf("%s:%d", mediaType, id)
}

func parseCompositeID(id string) (mediaType, tmdbID string, err error) {
	parts := strings.SplitN(id, ":", 2)
	if len(parts) != 2 {
		return "", "", fmt.Errorf("invalid selection id")
	}

	mediaType = parts[0]
	tmdbID = parts[1]
	if mediaType != "movie" && mediaType != "tv" {
		return "", "", fmt.Errorf("invalid media type")
	}
	if _, err := strconv.Atoi(tmdbID); err != nil {
		return "", "", fmt.Errorf("invalid tmdb id")
	}

	return mediaType, tmdbID, nil
}
