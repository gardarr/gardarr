package session

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"time"

	"github.com/gardarr/gardarr/internal/entities"
	"github.com/gardarr/gardarr/internal/infra/database"
	"github.com/gardarr/gardarr/internal/repository/session"
	"github.com/google/uuid"
)

const (
	sessionTokenLength = 32                 // 32 bytes = 256 bits
	sessionDuration    = 7 * 24 * time.Hour // 7 days
)

type Service struct {
	repository *session.Repository
}

func NewService(db *database.Database) *Service {
	return &Service{
		repository: session.NewRepository(db),
	}
}

// CreateSession creates a new session for a user
func (s *Service) CreateSession(ctx context.Context, userUUID uuid.UUID, userAgent, ipAddress string) (*entities.Session, error) {
	// Generate secure random token
	token, err := generateSessionToken()
	if err != nil {
		return nil, errors.New("failed to generate session token")
	}

	expiresAt := time.Now().Add(sessionDuration)

	return s.repository.CreateSession(ctx, userUUID, token, userAgent, ipAddress, expiresAt)
}

// ValidateSession validates a session token and returns the session if valid
func (s *Service) ValidateSession(ctx context.Context, token string) (*entities.User, *entities.Session, error) {
	sessionModel, err := s.repository.GetSessionByToken(ctx, token)
	if err != nil {
		return nil, nil, err
	}

	// Check if session is expired
	if sessionModel.IsExpired() {
		// Clean up expired session
		_ = s.repository.DeleteSession(ctx, token)
		return nil, nil, errors.New("session expired")
	}

	// Convert session to entity
	sessionEntity := &entities.Session{
		ID:        sessionModel.ID,
		UserUUID:  sessionModel.UserUUID,
		Token:     sessionModel.Token,
		UserAgent: sessionModel.UserAgent,
		IPAddress: sessionModel.IPAddress,
		ExpiresAt: sessionModel.ExpiresAt,
		CreatedAt: sessionModel.CreatedAt,
	}

	// Convert user to entity
	userEntity := &entities.User{
		UUID:      sessionModel.User.UUID,
		Username:  sessionModel.User.Username,
		Email:     sessionModel.User.Email,
		CreatedAt: sessionModel.User.CreatedAt,
		UpdatedAt: sessionModel.User.UpdatedAt,
	}

	return userEntity, sessionEntity, nil
}

// DeleteSession invalidates a session (logout)
func (s *Service) DeleteSession(ctx context.Context, token string) error {
	return s.repository.DeleteSession(ctx, token)
}

// DeleteUserSessions invalidates all sessions for a user (logout from all devices)
func (s *Service) DeleteUserSessions(ctx context.Context, userUUID uuid.UUID) error {
	return s.repository.DeleteUserSessions(ctx, userUUID)
}

// GetUserSessions retrieves all active sessions for a user
func (s *Service) GetUserSessions(ctx context.Context, userUUID uuid.UUID) ([]*entities.Session, error) {
	return s.repository.GetUserSessions(ctx, userUUID)
}

// CleanupExpiredSessions removes all expired sessions (should be called periodically)
func (s *Service) CleanupExpiredSessions(ctx context.Context) error {
	return s.repository.DeleteExpiredSessions(ctx)
}

// generateSessionToken generates a cryptographically secure random token
func generateSessionToken() (string, error) {
	token := make([]byte, sessionTokenLength)
	if _, err := rand.Read(token); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(token), nil
}
