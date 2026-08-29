package workermanager

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/jfxdev/gardarr/internal/entities"
	workerrepository "github.com/jfxdev/gardarr/internal/repository/worker"
	"github.com/jfxdev/gardarr/internal/schemas"
)

// peerTestRepo backs the queue-priority/peers/ban tests: it records the last
// call made to each of the three new repository methods so tests can assert
// the service passed the right arguments through.
type peerTestRepo struct {
	workerrepository.RepositoryInterface
	worker *entities.Worker

	lastQueueAction string
	queueErr        error

	peers    []*entities.TaskPeer
	peersErr error

	lastBanIP   string
	lastBanPort int
	banErr      error
}

func (f *peerTestRepo) GetWorkerByUUID(uuid.UUID) (*entities.Worker, error) {
	return f.worker, nil
}

func (f *peerTestRepo) SetWorkerTaskQueuePriority(_ *entities.Worker, _ string, schema schemas.TaskSetQueuePrioritySchema) error {
	f.lastQueueAction = schema.Action
	return f.queueErr
}

func (f *peerTestRepo) ListWorkerTaskPeers(*entities.Worker, string) ([]*entities.TaskPeer, error) {
	return f.peers, f.peersErr
}

func (f *peerTestRepo) BanWorkerPeer(_ *entities.Worker, ip string, port int) error {
	f.lastBanIP = ip
	f.lastBanPort = port
	return f.banErr
}

func TestSetWorkerTaskQueuePriority(t *testing.T) {
	workerID := uuid.New()
	repo := &peerTestRepo{worker: &entities.Worker{UUID: workerID}}
	service := &Service{repository: repo}

	err := service.SetWorkerTaskQueuePriority(context.Background(), workerID.String(), "task-1", schemas.TaskSetQueuePrioritySchema{Action: "top"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if repo.lastQueueAction != "top" {
		t.Fatalf("expected action 'top' to reach repository, got %q", repo.lastQueueAction)
	}
}

func TestSetWorkerTaskQueuePriorityPropagatesRepositoryError(t *testing.T) {
	workerID := uuid.New()
	repo := &peerTestRepo{worker: &entities.Worker{UUID: workerID}, queueErr: errors.New("qbittorrent unavailable")}
	service := &Service{repository: repo}

	err := service.SetWorkerTaskQueuePriority(context.Background(), workerID.String(), "task-1", schemas.TaskSetQueuePrioritySchema{Action: "bottom"})
	if err == nil {
		t.Fatal("expected error to propagate from repository, got nil")
	}
}

func TestSetWorkerTaskQueuePriorityInvalidWorkerID(t *testing.T) {
	service := &Service{repository: &peerTestRepo{}}

	err := service.SetWorkerTaskQueuePriority(context.Background(), "not-a-uuid", "task-1", schemas.TaskSetQueuePrioritySchema{Action: "top"})
	if err == nil {
		t.Fatal("expected error for invalid worker id, got nil")
	}
}

func TestListWorkerTaskPeers(t *testing.T) {
	workerID := uuid.New()
	want := []*entities.TaskPeer{{IP: "203.0.113.5", Port: 51413, CountryCode: "BR"}}
	repo := &peerTestRepo{worker: &entities.Worker{UUID: workerID}, peers: want}
	service := &Service{repository: repo}

	peers, err := service.ListWorkerTaskPeers(context.Background(), workerID.String(), "task-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(peers) != 1 || peers[0].CountryCode != "BR" {
		t.Fatalf("expected one BR peer, got %+v", peers)
	}
}

func TestListWorkerTaskPeersPropagatesRepositoryError(t *testing.T) {
	workerID := uuid.New()
	repo := &peerTestRepo{worker: &entities.Worker{UUID: workerID}, peersErr: errors.New("qbittorrent unavailable")}
	service := &Service{repository: repo}

	_, err := service.ListWorkerTaskPeers(context.Background(), workerID.String(), "task-1")
	if err == nil {
		t.Fatal("expected error to propagate from repository, got nil")
	}
}

func TestBanWorkerPeer(t *testing.T) {
	workerID := uuid.New()
	repo := &peerTestRepo{worker: &entities.Worker{UUID: workerID}}
	service := &Service{repository: repo}

	err := service.BanWorkerPeer(context.Background(), workerID.String(), schemas.WorkerBanPeerSchema{IP: "203.0.113.5", Port: 51413})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if repo.lastBanIP != "203.0.113.5" || repo.lastBanPort != 51413 {
		t.Fatalf("expected ban call with ip=203.0.113.5 port=51413, got ip=%s port=%d", repo.lastBanIP, repo.lastBanPort)
	}
}

func TestBanWorkerPeerPropagatesRepositoryError(t *testing.T) {
	workerID := uuid.New()
	repo := &peerTestRepo{worker: &entities.Worker{UUID: workerID}, banErr: errors.New("qbittorrent unavailable")}
	service := &Service{repository: repo}

	err := service.BanWorkerPeer(context.Background(), workerID.String(), schemas.WorkerBanPeerSchema{IP: "203.0.113.5", Port: 51413})
	if err == nil {
		t.Fatal("expected error to propagate from repository, got nil")
	}
}

func TestBulkTaskActionQueuePriority(t *testing.T) {
	workerID := uuid.New()

	tests := []struct {
		action       string
		expectedVerb string
	}{
		{"queue_top", "top"},
		{"queue_up", "up"},
		{"queue_down", "down"},
		{"queue_bottom", "bottom"},
	}

	for _, tt := range tests {
		t.Run(tt.action, func(t *testing.T) {
			repo := &peerTestRepo{worker: &entities.Worker{UUID: workerID}}
			service := &Service{repository: repo}

			result, err := service.BulkTaskAction(context.Background(), schemas.BulkTaskActionSchema{
				Action: tt.action,
				Items:  []schemas.BulkTaskItemSchema{{WorkerID: workerID.String(), Hash: "hash-1"}},
			})
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if result.Succeeded != 1 {
				t.Fatalf("expected 1 succeeded, got %d (failed: %v)", result.Succeeded, result.Failed)
			}
			if repo.lastQueueAction != tt.expectedVerb {
				t.Fatalf("expected repository action %q, got %q", tt.expectedVerb, repo.lastQueueAction)
			}
		})
	}
}
