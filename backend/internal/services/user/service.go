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

// CreateUser creates a new user with email and password
func (s *Service) CreateUser(ctx context.Context, email, password string) (*entities.User, error) {
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

	// Generate salt
	salt, err := generateSalt()
	if err != nil {
		return nil, errors.New("failed to generate salt")
	}

	// Hash password with argon2
	passwordHash := hashPassword(password, salt)

	// Create user in repository
	return s.repository.CreateUser(ctx, email, passwordHash, salt)
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
		CreatedAt: userModel.CreatedAt,
		UpdatedAt: userModel.UpdatedAt,
	}, nil
}

// GetUserByUUID retrieves a user by UUID
func (s *Service) GetUserByUUID(ctx context.Context, uuid string) (*entities.User, error) {
	return s.repository.GetUserByUUID(ctx, uuid)
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
