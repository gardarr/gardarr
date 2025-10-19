package entities

import (
	"time"

	"github.com/google/uuid"
)

// SignupToken represents a magic link token for user registration
type SignupToken struct {
	UUID      uuid.UUID
	Token     string
	Email     string
	Role      string
	ExpiresAt time.Time
	UsedAt    *time.Time
	CreatedAt time.Time
	UpdatedAt time.Time
}

// IsExpired checks if the token has expired
func (s *SignupToken) IsExpired() bool {
	return time.Now().After(s.ExpiresAt)
}

// IsUsed checks if the token has been used
func (s *SignupToken) IsUsed() bool {
	return s.UsedAt != nil
}

// IsValid checks if the token is valid for use
func (s *SignupToken) IsValid() bool {
	return !s.IsExpired() && !s.IsUsed()
}
