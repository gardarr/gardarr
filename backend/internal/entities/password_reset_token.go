package entities

import (
	"time"

	"github.com/google/uuid"
)

// PasswordResetToken represents a token for password reset
type PasswordResetToken struct {
	UUID      uuid.UUID
	Token     string
	Email     string
	ExpiresAt time.Time
	UsedAt    *time.Time
	CreatedAt time.Time
	UpdatedAt time.Time
}

// IsExpired checks if the token has expired
func (p *PasswordResetToken) IsExpired() bool {
	return time.Now().After(p.ExpiresAt)
}

// IsUsed checks if the token has been used
func (p *PasswordResetToken) IsUsed() bool {
	return p.UsedAt != nil
}

// IsValid checks if the token is valid for use
func (p *PasswordResetToken) IsValid() bool {
	return !p.IsExpired() && !p.IsUsed()
}
