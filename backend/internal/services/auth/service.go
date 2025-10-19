package auth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"strings"
	"time"

	"github.com/gardarr/gardarr/internal/entities"
	"github.com/gardarr/gardarr/internal/infra/database"
	"github.com/gardarr/gardarr/internal/repository/password_reset"
	"github.com/gardarr/gardarr/internal/repository/signup_token"
	"github.com/gardarr/gardarr/internal/services/user"
)

const (
	tokenLength                   = 32 // 32 bytes = 256 bits
	defaultPasswordResetExpiryHrs = 1  // Password reset token expires in 1 hour by default
)

// Service provides authentication-related operations including signup tokens and password reset
type Service struct {
	signupTokenRepo   *signup_token.Repository
	passwordResetRepo *password_reset.Repository
	userService       *user.Service
}

// NewService creates a new auth service instance
func NewService(db *database.Database) *Service {
	return &Service{
		signupTokenRepo:   signup_token.NewRepository(db),
		passwordResetRepo: password_reset.NewRepository(db),
		userService:       user.NewService(db),
	}
}

// ============================================================================
// SIGNUP TOKEN METHODS
// ============================================================================

// GenerateSignupToken creates a new signup token with the specified parameters
func (s *Service) GenerateSignupToken(ctx context.Context, role string, expiresInHours int, email string) (*entities.SignupToken, error) {
	// Validate role
	role = strings.TrimSpace(role)
	if role == "" {
		return nil, errors.New("role is required")
	}

	validRoles := map[string]bool{
		"admin": true,
		"user":  true,
	}
	if !validRoles[role] {
		return nil, errors.New("invalid role: must be 'admin' or 'user'")
	}

	// Validate expiration
	if expiresInHours < 1 {
		return nil, errors.New("expires_in must be at least 1 hour")
	}

	// Validate email if provided
	email = strings.TrimSpace(strings.ToLower(email))

	// Generate secure random token
	token, err := generateSecureToken()
	if err != nil {
		return nil, errors.New("failed to generate secure token")
	}

	// Calculate expiration time
	expiresAt := time.Now().Add(time.Duration(expiresInHours) * time.Hour)

	// Create token in repository
	return s.signupTokenRepo.CreateToken(ctx, token, email, role, expiresAt)
}

// ValidateAndUseSignupToken validates a signup token and creates a new user if valid
func (s *Service) ValidateAndUseSignupToken(ctx context.Context, tokenValue, email, password string) (*entities.User, error) {
	// Normalize inputs
	tokenValue = strings.TrimSpace(tokenValue)
	email = strings.TrimSpace(strings.ToLower(email))

	if tokenValue == "" {
		return nil, errors.New("token is required")
	}
	if email == "" {
		return nil, errors.New("email is required")
	}
	if password == "" {
		return nil, errors.New("password is required")
	}

	// Get token from repository
	signupToken, err := s.signupTokenRepo.GetTokenByValue(ctx, tokenValue)
	if err != nil {
		return nil, errors.New("invalid or expired token")
	}

	// Validate token
	if !signupToken.IsValid() {
		if signupToken.IsUsed() {
			return nil, errors.New("token has already been used")
		}
		if signupToken.IsExpired() {
			return nil, errors.New("token has expired")
		}
		return nil, errors.New("invalid token")
	}

	// If token has a specific email, verify it matches
	if signupToken.Email != "" && signupToken.Email != email {
		return nil, errors.New("token is not valid for this email address")
	}

	// Check if user already exists before creating
	existingUser, err := s.userService.GetUserByEmail(ctx, email)
	if err == nil && existingUser != nil {
		// User already exists - check if they can use this token
		if signupToken.IsUsed() {
			return nil, errors.New("this magic link has already been used to create an account. Please use the login page instead")
		}
		return nil, errors.New("an account with this email already exists. Please use the login page instead")
	}

	// Create the user
	user, err := s.userService.CreateUser(ctx, email, password)
	if err != nil {
		return nil, err
	}

	// Update the user's role to match the token
	if err := s.userService.UpdateUserRole(ctx, user.UUID.String(), signupToken.Role); err != nil {
		// If role update fails, we still have a user created
		// In production, you might want to handle this differently
		return nil, errors.New("failed to set user role")
	}
	user.Role = signupToken.Role

	// Mark token as used
	if err := s.signupTokenRepo.MarkTokenAsUsed(ctx, signupToken.UUID.String()); err != nil {
		// Log error but don't fail the operation since user was created
		// In production, you might want to handle this differently
	}

	return user, nil
}

// GetSignupTokenByValue retrieves a signup token by its value (for validation purposes)
func (s *Service) GetSignupTokenByValue(ctx context.Context, tokenValue string) (*entities.SignupToken, error) {
	tokenValue = strings.TrimSpace(tokenValue)
	if tokenValue == "" {
		return nil, errors.New("token is required")
	}

	return s.signupTokenRepo.GetTokenByValue(ctx, tokenValue)
}

// RevokeSignupToken revokes a signup token, preventing it from being used
func (s *Service) RevokeSignupToken(ctx context.Context, tokenValue string) error {
	tokenValue = strings.TrimSpace(tokenValue)
	if tokenValue == "" {
		return errors.New("token is required")
	}

	// Verify token exists before attempting to delete
	_, err := s.signupTokenRepo.GetTokenByValue(ctx, tokenValue)
	if err != nil {
		return errors.New("token not found")
	}

	return s.signupTokenRepo.DeleteToken(ctx, tokenValue)
}

// ListSignupTokens retrieves all signup tokens
func (s *Service) ListSignupTokens(ctx context.Context) ([]*entities.SignupToken, error) {
	return s.signupTokenRepo.ListTokens(ctx)
}

// CleanupExpiredSignupTokens removes expired signup tokens from the database
func (s *Service) CleanupExpiredSignupTokens(ctx context.Context) error {
	return s.signupTokenRepo.DeleteExpiredTokens(ctx)
}

// ============================================================================
// PASSWORD RESET METHODS
// ============================================================================

// GeneratePasswordResetToken creates a new password reset token for a user
func (s *Service) GeneratePasswordResetToken(ctx context.Context, email string) (*entities.PasswordResetToken, error) {
	// Normalize email
	email = strings.TrimSpace(strings.ToLower(email))

	if email == "" {
		return nil, errors.New("email is required")
	}

	// Verify user exists
	_, err := s.userService.GetUserByEmail(ctx, email)
	if err != nil {
		// Don't reveal if user exists or not for security
		return nil, errors.New("if a user with this email exists, a password reset link will be sent")
	}

	// Generate secure random token
	token, err := generateSecureToken()
	if err != nil {
		return nil, errors.New("failed to generate secure token")
	}

	// Calculate expiration time
	expiresAt := time.Now().Add(time.Duration(defaultPasswordResetExpiryHrs) * time.Hour)

	// Invalidate any existing tokens for this email
	_ = s.passwordResetRepo.DeleteTokensByEmail(ctx, email)

	// Create token in repository
	return s.passwordResetRepo.CreateToken(ctx, token, email, expiresAt)
}

// ValidateAndResetPassword validates a token and resets the user's password
func (s *Service) ValidateAndResetPassword(ctx context.Context, tokenValue, newPassword string) error {
	// Normalize inputs
	tokenValue = strings.TrimSpace(tokenValue)

	if tokenValue == "" {
		return errors.New("token is required")
	}
	if newPassword == "" {
		return errors.New("new password is required")
	}
	if len(newPassword) < 8 {
		return errors.New("password must be at least 8 characters")
	}

	// Get token from repository
	resetToken, err := s.passwordResetRepo.GetTokenByValue(ctx, tokenValue)
	if err != nil {
		return errors.New("invalid or expired token")
	}

	// Validate token
	if !resetToken.IsValid() {
		if resetToken.IsUsed() {
			return errors.New("token has already been used")
		}
		if resetToken.IsExpired() {
			return errors.New("token has expired")
		}
		return errors.New("invalid token")
	}

	// Update user's password
	if err := s.userService.UpdatePassword(ctx, resetToken.Email, newPassword); err != nil {
		return err
	}

	// Mark token as used
	if err := s.passwordResetRepo.MarkTokenAsUsed(ctx, resetToken.UUID.String()); err != nil {
		// Log error but don't fail the operation since password was updated
		// In production, you might want to log this
	}

	return nil
}

// GetPasswordResetTokenByValue retrieves a password reset token by its value (for validation purposes)
func (s *Service) GetPasswordResetTokenByValue(ctx context.Context, tokenValue string) (*entities.PasswordResetToken, error) {
	tokenValue = strings.TrimSpace(tokenValue)
	if tokenValue == "" {
		return nil, errors.New("token is required")
	}

	return s.passwordResetRepo.GetTokenByValue(ctx, tokenValue)
}

// RevokePasswordResetTokensByEmail revokes all password reset tokens for a specific email
func (s *Service) RevokePasswordResetTokensByEmail(ctx context.Context, email string) error {
	email = strings.TrimSpace(strings.ToLower(email))
	if email == "" {
		return errors.New("email is required")
	}

	return s.passwordResetRepo.DeleteTokensByEmail(ctx, email)
}

// CleanupExpiredPasswordResetTokens removes expired password reset tokens from the database
func (s *Service) CleanupExpiredPasswordResetTokens(ctx context.Context) error {
	return s.passwordResetRepo.DeleteExpiredTokens(ctx)
}

// ============================================================================
// CLEANUP METHODS
// ============================================================================

// CleanupAllExpiredTokens removes all expired tokens (both signup and password reset)
func (s *Service) CleanupAllExpiredTokens(ctx context.Context) error {
	// Cleanup signup tokens
	if err := s.CleanupExpiredSignupTokens(ctx); err != nil {
		return err
	}

	// Cleanup password reset tokens
	if err := s.CleanupExpiredPasswordResetTokens(ctx); err != nil {
		return err
	}

	return nil
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// generateSecureToken generates a cryptographically secure random token
func generateSecureToken() (string, error) {
	bytes := make([]byte, tokenLength)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	// Use URL-safe base64 encoding for the token
	return base64.URLEncoding.EncodeToString(bytes), nil
}
