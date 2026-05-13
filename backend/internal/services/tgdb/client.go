package tgdb

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"time"
)

const (
	baseURL = "https://api.thegamesdb.net/v1.1"
)

// GameResult represents a single game returned by the API
type GameResult struct {
	ID          int    `json:"id"`
	GameTitle   string `json:"game_title"`
	ReleaseDate string `json:"release_date"`
	Platform    int    `json:"platform"`
	Overview    string `json:"overview"`
}

// BoxartImage represents an image associated with a game
type BoxartImage struct {
	ID         int    `json:"id"`
	Type       string `json:"type"`
	Side       string `json:"side"`
	Filename   string `json:"filename"`
	Resolution string `json:"resolution"`
}

// BoxartData holds the base URLs and the image data mapped by game ID
type BoxartData struct {
	BaseURL struct {
		Original           string `json:"original"`
		Small              string `json:"small"`
		Thumb              string `json:"thumb"`
		CroppedCenterThumb string `json:"cropped_center_thumb"`
		Medium             string `json:"medium"`
		Large              string `json:"large"`
	} `json:"base_url"`
	Data map[string][]BoxartImage `json:"data"`
}

// IncludeData contains additional requested data (like boxart)
type IncludeData struct {
	Boxart BoxartData `json:"boxart"`
}

// GamesResponse is the structure of the API response
type GamesResponse struct {
	Code   int    `json:"code"`
	Status string `json:"status"`
	Data   struct {
		Count int          `json:"count"`
		Games []GameResult `json:"games"`
	} `json:"data"`
	Include IncludeData `json:"include"`
}

// Client interacts with the TGDB API
type Client struct {
	httpClient *http.Client
	apiKey     string
}

// NewClient creates a new TGDB API client
func NewClient(apiKey string) *Client {
	return &Client{
		httpClient: &http.Client{Timeout: 10 * time.Second},
		apiKey:     apiKey,
	}
}

// DefaultClient creates a client using the TGDB_KEY environment variable
func DefaultClient() *Client {
	return NewClient(os.Getenv("TGDB_KEY"))
}

// IsActive returns true if the integration is configured (API key is present)
func (c *Client) IsActive() bool {
	return c.apiKey != ""
}

// SearchGames searches for games by name and includes their overviews and boxarts
func (c *Client) SearchGames(ctx context.Context, query string) (*GamesResponse, error) {
	if !c.IsActive() {
		return nil, fmt.Errorf("TGDB integration is not active")
	}

	reqURL, err := url.Parse(fmt.Sprintf("%s/Games/ByGameName", baseURL))
	if err != nil {
		return nil, err
	}

	q := reqURL.Query()
	q.Add("apikey", c.apiKey)
	q.Add("name", query)
	q.Add("fields", "overview")
	q.Add("include", "boxart")
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

	var result GamesResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	if result.Code != 200 {
		return nil, fmt.Errorf("api error: %s", result.Status)
	}

	return &result, nil
}
