package task_metadata

import (
	"context"
	"errors"
)

var (
	ErrProviderNotFound          = errors.New("provider not found")
	ErrProviderSelectionNotFound = errors.New("provider selection not found")
)

type MetadataProviderSearchResult struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	ReleaseDate string `json:"release_date,omitempty"`
	Description string `json:"description,omitempty"`
	ImageURL    string `json:"image_url,omitempty"`
}

type MetadataProviderSelection struct {
	ID          string
	Title       string
	ReleaseDate string
	Description string
	ImageURL    string
}

type MetadataProviderStatus struct {
	Provider string `json:"provider"`
	Active   bool   `json:"active"`
}

type MetadataProvider interface {
	Name() string
	Status(ctx context.Context) (*MetadataProviderStatus, error)
	Search(ctx context.Context, query string) ([]MetadataProviderSearchResult, error)
	Resolve(ctx context.Context, id string) (*MetadataProviderSelection, error)
	AllowedImageHosts() []string
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
