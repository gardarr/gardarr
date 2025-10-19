package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// PasswordResetToken represents the database model for password reset tokens
type PasswordResetToken struct {
	UUID      uuid.UUID  `gorm:"type:uuid;primaryKey;uniqueIndex"`
	Token     string     `gorm:"size:255;uniqueIndex;not null"`
	Email     string     `gorm:"size:255;not null;index"`
	ExpiresAt time.Time  `gorm:"not null;index"`
	UsedAt    *time.Time `gorm:"index"`
	CreatedAt time.Time
	UpdatedAt time.Time
}

func (p *PasswordResetToken) BeforeCreate(tx *gorm.DB) (err error) {
	if p.UUID == uuid.Nil {
		p.UUID = uuid.New()
	}

	p.CreatedAt = time.Now()
	p.UpdatedAt = time.Now()
	return
}

func (p *PasswordResetToken) BeforeUpdate(tx *gorm.DB) (err error) {
	p.UpdatedAt = time.Now()
	return
}

// RequestPasswordResetRequest represents the request to initiate password reset
type RequestPasswordResetRequest struct {
	Email string `json:"email" binding:"required,email"`
}

// ResetPasswordRequest represents the request to reset password using token
type ResetPasswordRequest struct {
	Token       string `json:"token" binding:"required"`
	NewPassword string `json:"new_password" binding:"required,min=8"`
}

// PasswordResetTokenResponse represents the response for password reset token operations
type PasswordResetTokenResponse struct {
	Token     string    `json:"token"`
	Email     string    `json:"email"`
	ExpiresAt time.Time `json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`
}
