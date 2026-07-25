package tmdb

import (
	"context"
	"encoding/base64"
	"testing"

	"github.com/jfxdev/gardarr/internal/infra/database"
	"github.com/jfxdev/gardarr/internal/models"
	cryptoService "github.com/jfxdev/gardarr/internal/services/crypto"
	integrationService "github.com/jfxdev/gardarr/internal/services/integration"
	tmdbclient "github.com/jfxdev/gardarr/internal/services/tmdb"
	"github.com/jfxdev/gardarr/pkg/gen"
)

func setupTMDBProvider(t *testing.T) *MetadataProvider {
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

	if _, err := configSvc.UpdateProvider(context.Background(), integrationService.MetadataSourceTMDB, true, "provider-key"); err != nil {
		t.Fatalf("failed to seed provider config: %v", err)
	}

	return NewMetadataProvider(configSvc)
}

func TestTMDBMetadataProviderStatus(t *testing.T) {
	provider := setupTMDBProvider(t)

	status, err := provider.Status(context.Background())
	if err != nil {
		t.Fatalf("Status failed: %v", err)
	}

	if !status.Active {
		t.Error("expected TMDB provider to be active")
	}
}

func TestBuildSelectionMapsMovieFields(t *testing.T) {
	selection := buildSelection(tmdbclient.SearchResult{
		ID:          123,
		MediaType:   "movie",
		Title:       "Test Movie",
		ReleaseDate: "2024-01-01",
		Overview:    "Overview",
		PosterPath:  "/poster.jpg",
	})

	if selection.ID != "movie:123" || selection.Title != "Test Movie" || selection.Description != "Overview" {
		t.Fatalf("unexpected selection: %#v", selection)
	}
	if selection.ImageID != "poster.jpg" {
		t.Fatalf("unexpected image ID: %s", selection.ImageID)
	}
	if selection.ImageURL != "https://image.tmdb.org/t/p/w500/poster.jpg" {
		t.Fatalf("unexpected image URL: %s", selection.ImageURL)
	}
}

func TestBuildSelectionMapsTVFields(t *testing.T) {
	selection := buildSelection(tmdbclient.SearchResult{
		ID:           456,
		MediaType:    "tv",
		Name:         "Test Show",
		FirstAirDate: "2020-05-05",
		Overview:     "Show overview",
		PosterPath:   "/show.jpg",
	})

	if selection.ID != "tv:456" || selection.Title != "Test Show" || selection.ReleaseDate != "2020-05-05" {
		t.Fatalf("unexpected selection: %#v", selection)
	}
}

func TestBuildSelectionWithoutPoster(t *testing.T) {
	selection := buildSelection(tmdbclient.SearchResult{
		ID:        123,
		MediaType: "movie",
		Title:     "No Poster",
	})

	if selection.ImageID != "" || selection.ImageURL != "" {
		t.Fatalf("expected empty image fields, got %#v", selection)
	}
}

func TestMetadataProviderBuildImageURL(t *testing.T) {
	provider := setupTMDBProvider(t)

	imageURL, err := provider.BuildImageURL("/poster.jpg")
	if err != nil {
		t.Fatalf("BuildImageURL failed: %v", err)
	}
	if imageURL != "https://image.tmdb.org/t/p/original/poster.jpg" {
		t.Fatalf("unexpected image URL: %s", imageURL)
	}
}

func TestMetadataProviderBuildImageURLRejectsInvalidID(t *testing.T) {
	provider := setupTMDBProvider(t)

	if _, err := provider.BuildImageURL("https://evil.example.com/poster.jpg"); err == nil {
		t.Fatal("expected error for invalid image id")
	}

	if _, err := provider.BuildImageURL("nested/poster.jpg"); err == nil {
		t.Fatal("expected error for path-containing image id")
	}
}

func TestMetadataProviderAllowedImageHosts(t *testing.T) {
	provider := setupTMDBProvider(t)

	hosts := provider.AllowedImageHosts()

	if len(hosts) != 1 || hosts[0] != "image.tmdb.org" {
		t.Fatalf("unexpected allowed image hosts: %#v", hosts)
	}
}

func TestParseCompositeID(t *testing.T) {
	tests := []struct {
		id        string
		wantErr   bool
		wantType  string
		wantTMDID string
	}{
		{"movie:123", false, "movie", "123"},
		{"tv:456", false, "tv", "456"},
		{"invalid", true, "", ""},
		{"book:123", true, "", ""},
		{"movie:abc", true, "", ""},
	}

	for _, tt := range tests {
		mediaType, tmdbID, err := parseCompositeID(tt.id)
		if tt.wantErr {
			if err == nil {
				t.Errorf("parseCompositeID(%q): expected error, got nil", tt.id)
			}
			continue
		}
		if err != nil {
			t.Errorf("parseCompositeID(%q): unexpected error: %v", tt.id, err)
		}
		if mediaType != tt.wantType || tmdbID != tt.wantTMDID {
			t.Errorf("parseCompositeID(%q) = (%q, %q), want (%q, %q)", tt.id, mediaType, tmdbID, tt.wantType, tt.wantTMDID)
		}
	}
}

func TestMetadataProviderResolveRejectsInvalidID(t *testing.T) {
	provider := setupTMDBProvider(t)

	if _, err := provider.Resolve(context.Background(), "invalid"); err == nil {
		t.Fatal("expected error for invalid composite id")
	}
}
