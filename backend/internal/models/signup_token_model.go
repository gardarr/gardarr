package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// SignupToken represents the database model for signup tokens
type SignupToken struct {
	UUID      uuid.UUID  `gorm:"type:uuid;primaryKey;uniqueIndex"`
	Token     string     `gorm:"size:255;uniqueIndex;not null"`
	Email     string     `gorm:"size:255;index"`
	Role      string     `gorm:"size:50;not null"`
	ExpiresAt time.Time  `gorm:"not null;index"`
	UsedAt    *time.Time `gorm:"index"`
	CreatedAt time.Time
	UpdatedAt time.Time
}

func (s *SignupToken) BeforeCreate(tx *gorm.DB) (err error) {
	if s.UUID == uuid.Nil {
		s.UUID = uuid.New()
	}

	s.CreatedAt = time.Now()
	s.UpdatedAt = time.Now()
	return
}

func (s *SignupToken) BeforeUpdate(tx *gorm.DB) (err error) {
	s.UpdatedAt = time.Now()
	return
}

// CreateSignupTokenRequest represents the request body to create a signup token
type CreateSignupTokenRequest struct {
	Role      string `json:"role" binding:"required"`
	ExpiresIn int    `json:"expires_in" binding:"required,min=1"` // Duration in hours
	Email     string `json:"email"`                               // Optional email
}

// SignupTokenResponse represents the response body for signup token operations
type SignupTokenResponse struct {
	Token     string    `json:"token"`
	Email     string    `json:"email,omitempty"`
	Role      string    `json:"role"`
	ExpiresAt time.Time `json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`
}

// VerifySignupTokenRequest represents the request to verify and use a signup token
type VerifySignupTokenRequest struct {
	Token    string `json:"token" binding:"required"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
}

// ListSignupTokensResponse represents the response body for listing signup tokens
type ListSignupTokensResponse struct {
	Tokens []SignupTokenListItem `json:"tokens"`
	Total  int                   `json:"total"`
}

// SignupTokenListItem represents a signup token in the list (without exposing the actual token value for security)
type SignupTokenListItem struct {
	Token     string     `json:"token"` // Token value for revocation
	Email     string     `json:"email,omitempty"`
	Role      string     `json:"role"`
	ExpiresAt time.Time  `json:"expires_at"`
	UsedAt    *time.Time `json:"used_at,omitempty"`
	Used      bool       `json:"used"`
	CreatedAt time.Time  `json:"created_at"`
}
