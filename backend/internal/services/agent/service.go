package agent

import (
	"github.com/gardarr/gardarr/internal/infra/database"
	"github.com/gardarr/gardarr/internal/repository/agent"
	"github.com/gardarr/gardarr/internal/services/crypto"
)

type Service struct {
	repository *agent.Repository
}

func NewService(db *database.Database, c *crypto.CryptoService) *Service {
	return &Service{
		repository: agent.NewRepository(db, c),
	}
}
