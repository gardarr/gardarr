package tmdb

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"
)

const (
	baseURL = "https://api.themoviedb.org/3"
)

// SearchResult represents a single movie/tv item returned by TMDB's multi-search
type SearchResult struct {
	ID           int    `json:"id"`
	MediaType    string `json:"media_type"`
	Title        string `json:"title"`
	Name         string `json:"name"`
	ReleaseDate  string `json:"release_date"`
	FirstAirDate string `json:"first_air_date"`
	Overview     string `json:"overview"`
	PosterPath   string `json:"poster_path"`
}

// SearchMultiResponse is the structure of the TMDB /search/multi response
type SearchMultiResponse struct {
	Page    int            `json:"page"`
	Results []SearchResult `json:"results"`
}

// Client interacts with the TMDB API
type Client struct {
	httpClient *http.Client
	apiKey     string
}

// NewClient creates a new TMDB API client
func NewClient(apiKey string) *Client {
	return &Client{
		httpClient: &http.Client{Timeout: 10 * time.Second},
		apiKey:     apiKey,
	}
}

// IsActive returns true if the integration is configured (API key is present)
func (c *Client) IsActive() bool {
	return c.apiKey != ""
}

// SearchMulti searches for movies and TV shows by query
func (c *Client) SearchMulti(ctx context.Context, query string) (*SearchMultiResponse, error) {
	if !c.IsActive() {
		return nil, fmt.Errorf("TMDB integration is not active")
	}

	reqURL, err := url.Parse(fmt.Sprintf("%s/search/multi", baseURL))
	if err != nil {
		return nil, err
	}

	q := reqURL.Query()
	q.Add("api_key", c.apiKey)
	q.Add("query", query)
	q.Add("include_adult", "false")
	reqURL.RawQuery = q.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL.String(), nil)
	if err != nil {
		return nil, err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	var result SearchMultiResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return &result, nil
}

// GetByID fetches a single TMDB item by media type ("movie" or "tv") and id
func (c *Client) GetByID(ctx context.Context, mediaType, id string) (*SearchResult, error) {
	if !c.IsActive() {
		return nil, fmt.Errorf("TMDB integration is not active")
	}
	if mediaType != "movie" && mediaType != "tv" {
		return nil, fmt.Errorf("invalid media type: %s", mediaType)
	}

	reqURL, err := url.Parse(fmt.Sprintf("%s/%s/%s", baseURL, mediaType, id))
	if err != nil {
		return nil, err
	}

	q := reqURL.Query()
	q.Add("api_key", c.apiKey)
	reqURL.RawQuery = q.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL.String(), nil)
	if err != nil {
		return nil, err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	var result SearchResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	result.MediaType = mediaType

	return &result, nil
}
