package user

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"strings"

	"golang.org/x/crypto/argon2"

	"github.com/gardarr/gardarr/internal/entities"
	"github.com/gardarr/gardarr/internal/infra/database"
	"github.com/gardarr/gardarr/internal/repository/user"
)

const (
	// Argon2 parameters - tuned for security
	// Time=3, Memory=128MB provides strong protection against brute-force attacks
	// while maintaining reasonable performance (~200-300ms per hash)
	argon2Time    = 3
	argon2Memory  = 128 * 1024
	argon2Threads = 4
	argon2KeyLen  = 32
	saltLength    = 16
)

type Service struct {
	repository *user.Repository
}

func NewService(db *database.Database) *Service {
	return &Service{
		repository: user.NewRepository(db),
	}
}

// CreateUser creates a new user with email and password (default role: user)
func (s *Service) CreateUser(ctx context.Context, email, password string) (*entities.User, error) {
	return s.CreateUserWithRole(ctx, email, password, "user", false)
}

// CreateUserWithRole creates a new user with email, password, and specific role
func (s *Service) CreateUserWithRole(ctx context.Context, email, password, role string, founder bool) (*entities.User, error) {
	// Validate input
	email = strings.TrimSpace(strings.ToLower(email))
	if email == "" {
		return nil, errors.New("email is required")
	}
	if password == "" {
		return nil, errors.New("password is required")
	}
	if len(password) < 8 {
		return nil, errors.New("password must be at least 8 characters")
	}

	// Validate role
	validRoles := map[string]bool{
		"admin": true,
		"user":  true,
	}
	if !validRoles[role] {
		return nil, errors.New("invalid role: must be 'admin' or 'user'")
	}

	if founder && role != "admin" {
		return nil, errors.New("founder role can only be assigned to admin users")
	}

	// Generate salt
	salt, err := generateSalt()
	if err != nil {
		return nil, errors.New("failed to generate salt")
	}

	// Hash password with argon2
	passwordHash := hashPassword(password, salt)

	// Create user in repository
	return s.repository.CreateUserWithRole(ctx, email, passwordHash, salt, role, founder)
}

// CountUsers returns the total number of users in the system
func (s *Service) CountUsers(ctx context.Context) (int64, error) {
	return s.repository.CountUsers(ctx)
}

// VerifyPassword verifies if the provided password matches the user's password
func (s *Service) VerifyPassword(ctx context.Context, email, password string) (*entities.User, error) {
	email = strings.TrimSpace(strings.ToLower(email))

	// Get user from repository
	userModel, err := s.repository.GetUserByEmail(ctx, email)
	if err != nil {
		return nil, err
	}

	// Hash the provided password with the stored salt
	providedHash := hashPassword(password, userModel.Salt)

	// Compare hashes
	if providedHash != userModel.PasswordHash {
		return nil, errors.New("invalid credentials")
	}

	// Convert to entity
	return &entities.User{
		UUID:      userModel.UUID,
		Username:  userModel.Username,
		Email:     userModel.Email,
		Role:      userModel.Role,
		CreatedAt: userModel.CreatedAt,
		UpdatedAt: userModel.UpdatedAt,
	}, nil
}

// GetUserByUUID retrieves a user by UUID
func (s *Service) GetUserByUUID(ctx context.Context, uuid string) (*entities.User, error) {
	return s.repository.GetUserByUUID(ctx, uuid)
}

// GetUserByEmail retrieves a user by email
func (s *Service) GetUserByEmail(ctx context.Context, email string) (*entities.User, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	userModel, err := s.repository.GetUserByEmail(ctx, email)
	if err != nil {
		return nil, err
	}

	return &entities.User{
		UUID:      userModel.UUID,
		Username:  userModel.Username,
		Email:     userModel.Email,
		Role:      userModel.Role,
		CreatedAt: userModel.CreatedAt,
		UpdatedAt: userModel.UpdatedAt,
	}, nil
}

// ListUsers retrieves all users
func (s *Service) ListUsers(ctx context.Context) ([]*entities.User, error) {
	return s.repository.ListUsers(ctx)
}

// UpdateUserRole updates the role of a user
func (s *Service) UpdateUserRole(ctx context.Context, uuid, role string) error {
	// Validate role
	validRoles := map[string]bool{
		"admin": true,
		"user":  true,
	}
	if !validRoles[role] {
		return errors.New("invalid role: must be 'admin' or 'user'")
	}

	return s.repository.UpdateUserRole(ctx, uuid, role)
}

// UpdatePassword updates the password for a user
func (s *Service) UpdatePassword(ctx context.Context, email, newPassword string) error {
	email = strings.TrimSpace(strings.ToLower(email))

	if email == "" {
		return errors.New("email is required")
	}
	if newPassword == "" {
		return errors.New("password is required")
	}
	if len(newPassword) < 8 {
		return errors.New("password must be at least 8 characters")
	}

	// Check if user exists
	_, err := s.repository.GetUserByEmail(ctx, email)
	if err != nil {
		return errors.New("user not found")
	}

	// Generate new salt
	salt, err := generateSalt()
	if err != nil {
		return errors.New("failed to generate salt")
	}

	// Hash new password with new salt
	passwordHash := hashPassword(newPassword, salt)

	// Update password in repository
	return s.repository.UpdatePassword(ctx, email, passwordHash, salt)
}

// DeleteUser deletes a user by UUID
func (s *Service) DeleteUser(ctx context.Context, uuid string) error {
	if uuid == "" {
		return errors.New("uuid is required")
	}

	// Check if user is a founder
	user, err := s.repository.GetUserByUUID(ctx, uuid)
	if err != nil {
		return err
	}

	if user.Founder {
		return errors.New("founder users cannot be deleted")
	}

	return s.repository.DeleteUser(ctx, uuid)
}

// generateSalt generates a random salt for password hashing
func generateSalt() (string, error) {
	salt := make([]byte, saltLength)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(salt), nil
}

// hashPassword hashes a password using argon2id with the provided salt
func hashPassword(password, salt string) string {
	saltBytes, _ := base64.StdEncoding.DecodeString(salt)
	hash := argon2.IDKey([]byte(password), saltBytes, argon2Time, argon2Memory, argon2Threads, argon2KeyLen)
	return base64.StdEncoding.EncodeToString(hash)
}
