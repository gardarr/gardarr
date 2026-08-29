package task

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/jfxdev/go-qbt"
)

func newTestClient(t *testing.T, handler http.HandlerFunc) *qbt.Client {
	t.Helper()
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)

	client, err := qbt.New(qbt.Config{BaseURL: server.URL})
	if err != nil {
		t.Fatalf("failed to create qbt client: %v", err)
	}
	return client
}

func TestRepositorySetQueuePriority(t *testing.T) {
	tests := []struct {
		action       string
		expectedPath string
	}{
		{"top", "/api/v2/torrents/topPrio"},
		{"up", "/api/v2/torrents/increasePrio"},
		{"down", "/api/v2/torrents/decreasePrio"},
		{"bottom", "/api/v2/torrents/bottomPrio"},
	}

	for _, tt := range tests {
		t.Run(tt.action, func(t *testing.T) {
			var gotPath string
			client := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
				gotPath = r.URL.Path
				w.WriteHeader(http.StatusOK)
			})

			repo := New(client)
			if err := repo.SetQueuePriority("abc123", tt.action); err != nil {
				t.Fatalf("expected no error, got %v", err)
			}
			if gotPath != tt.expectedPath {
				t.Errorf("expected path %s, got %s", tt.expectedPath, gotPath)
			}
		})
	}
}

func TestRepositorySetQueuePriorityInvalidAction(t *testing.T) {
	client := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("no HTTP request should be made for an invalid action")
	})

	repo := New(client)
	if err := repo.SetQueuePriority("abc123", "sideways"); err == nil {
		t.Fatal("expected error for invalid action, got nil")
	}
}

func TestRepositorySetQueuePriorityPropagatesError(t *testing.T) {
	client := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusForbidden)
	})

	repo := New(client)
	if err := repo.SetQueuePriority("abc123", "top"); err == nil {
		t.Fatal("expected error when qBittorrent returns non-200, got nil")
	}
}

func TestRepositoryListPeers(t *testing.T) {
	// The client issues a version/login preflight before the actual GET on
	// a fresh session - only the peers endpoint's response body matters here.
	client := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v2/sync/torrentPeers" {
			w.WriteHeader(http.StatusOK)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"peers": map[string]qbt.TorrentPeer{
				"203.0.113.5:51413": {
					IP:            "203.0.113.5",
					Port:          51413,
					Client:        "qBittorrent/4.6.0",
					Country:       "Brazil",
					CountryCode:   "BR",
					Downloaded:    1024,
					DownloadSpeed: 512,
					Progress:      0.5,
					Uploaded:      2048,
					UploadSpeed:   256,
				},
			},
		})
	})

	repo := New(client)
	peers, err := repo.ListPeers("abc123")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(peers) != 1 {
		t.Fatalf("expected 1 peer, got %d", len(peers))
	}

	p := peers[0]
	if p.IP != "203.0.113.5" || p.CountryCode != "BR" || p.Port != 51413 {
		t.Errorf("unexpected peer mapping: %+v", p)
	}
}

func TestRepositoryListPeersPropagatesError(t *testing.T) {
	// 403 (non-retryable) keeps this test fast; a 5xx status would trigger
	// the SDK's built-in retry+backoff loop and slow the suite down a lot.
	client := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusForbidden)
	})

	repo := New(client)
	if _, err := repo.ListPeers("abc123"); err == nil {
		t.Fatal("expected error when qBittorrent returns non-200, got nil")
	}
}
