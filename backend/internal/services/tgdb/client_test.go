package tgdb

import (
	"context"
	"io"
	"net/http"
	"os"
	"strings"
	"testing"
)

func TestDefaultClientUsesSecretFile(t *testing.T) {
	secretFile := t.TempDir() + "/tgdb-key"
	if err := os.WriteFile(secretFile, []byte("secret-api-key\n"), 0o600); err != nil {
		t.Fatalf("write secret file: %v", err)
	}
	t.Setenv("TGDB_KEY", "")
	t.Setenv("TGDB_KEY_FILE", secretFile)

	client := DefaultClient()
	if client.apiKey != "secret-api-key" {
		t.Errorf("expected API key from secret file, got %q", client.apiKey)
	}
}

func TestClientGetGameByID(t *testing.T) {
	client := NewClient("test-key")
	client.httpClient = &http.Client{
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			if req.URL.Path != "/v1.1/Games/ByGameID" {
				t.Fatalf("unexpected path: %s", req.URL.Path)
			}
			if req.URL.Query().Get("id") != "123" {
				t.Fatalf("unexpected id query: %s", req.URL.Query().Get("id"))
			}
			if req.URL.Query().Get("include") != "boxart" {
				t.Fatalf("expected boxart include, got %s", req.URL.Query().Get("include"))
			}
			if req.URL.Query().Get("fields") != "overview" {
				t.Fatalf("expected overview fields, got %s", req.URL.Query().Get("fields"))
			}

			return &http.Response{
				StatusCode: http.StatusOK,
				Body: io.NopCloser(strings.NewReader(`{
					"code": 200,
					"status": "Success",
					"data": {
						"count": 1,
						"games": [{"id": 123, "game_title": "Test Game", "release_date": "2024-01-01", "overview": "Overview"}]
					},
					"include": {
						"boxart": {
							"base_url": {"large": "https://cdn.thegamesdb.net/images/large/"},
							"data": {"123": [{"side": "front", "filename": "boxart/test.jpg"}]}
						}
					}
				}`)),
				Header: http.Header{"Content-Type": []string{"application/json"}},
			}, nil
		}),
	}

	result, err := client.GetGameByID(context.Background(), "123")
	if err != nil {
		t.Fatalf("GetGameByID failed: %v", err)
	}
	if result == nil || len(result.Data.Games) != 1 {
		t.Fatalf("expected one game, got %#v", result)
	}
	if result.Data.Games[0].ID != 123 {
		t.Fatalf("expected ID 123, got %d", result.Data.Games[0].ID)
	}
}

func TestClientGetGameByIDNotFound(t *testing.T) {
	client := NewClient("test-key")
	client.httpClient = &http.Client{
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			return &http.Response{
				StatusCode: http.StatusOK,
				Body: io.NopCloser(strings.NewReader(`{
					"code": 200,
					"status": "Success",
					"data": {"count": 0, "games": []},
					"include": {"boxart": {"base_url": {"large": "https://cdn.thegamesdb.net/images/large/"}, "data": {}}}
				}`)),
				Header: http.Header{"Content-Type": []string{"application/json"}},
			}, nil
		}),
	}

	result, err := client.GetGameByID(context.Background(), "404")
	if err != nil {
		t.Fatalf("GetGameByID failed: %v", err)
	}
	if result == nil {
		t.Fatal("expected non-nil result")
	}
	if result.Data.Count != 0 || len(result.Data.Games) != 0 {
		t.Fatalf("expected empty result, got %#v", result.Data)
	}
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}
