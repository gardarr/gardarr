package workermanager

import (
	"fmt"

	"github.com/google/uuid"
	"github.com/jfxdev/gardarr/internal/entities"
)

// fetchWorker retrieves a worker by ID string
func (s *Service) fetchWorker(id string) (*entities.Worker, error) {
	uid, err := uuid.Parse(id)
	if err != nil {
		return nil, fmt.Errorf("invalid worker UUID format: %w", err)
	}

	worker, err := s.repository.GetWorkerByUUID(uid)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve worker: %w", err)
	}

	return worker, nil
}
