package setup

import (
	"context"

	"github.com/jfxdev/gardarr/internal/entities"
	"github.com/jfxdev/gardarr/internal/services/user"
)

type Service struct {
	userService *user.Service
}

func NewService(userService *user.Service) *Service {
	return &Service{
		userService: userService,
	}
}

func (s *Service) Initialized(ctx context.Context) (bool, error) {
	count, err := s.userService.CountUsers(ctx)
	if err != nil {
		return false, err
	}

	return count > 0, nil
}

func (s *Service) CreateAdmin(ctx context.Context, email, password string) (*entities.User, error) {
	return s.userService.CreateUserWithRole(ctx, email, password, "admin", true)
}
