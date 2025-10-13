package user

import (
	"context"
	"errors"
	"strings"

	"github.com/gardarr/gardarr/internal/entities"
	"github.com/gardarr/gardarr/internal/infra/database"
	"github.com/gardarr/gardarr/internal/models"
	"gorm.io/gorm"
)

type Repository struct {
	db *database.Database
}

func NewRepository(db *database.Database) *Repository {
	return &Repository{
		db: db,
	}
}

// CreateUser inserts a new user into the database
func (r *Repository) CreateUser(ctx context.Context, email, passwordHash, salt string) (*entities.User, error) {
	model := &models.User{
		Email:        email,
		PasswordHash: passwordHash,
		Salt:         salt,
	}

	if err := r.db.DB.WithContext(ctx).Create(model).Error; err != nil {
		if isDuplicateKeyError(err) {
			return nil, errors.New("user with this email already exists")
		}
		return nil, err
	}

	return toEntity(*model), nil
}

// isDuplicateKeyError checks if the error is a duplicate key error
// Compatible with both SQLite and PostgreSQL
func isDuplicateKeyError(err error) bool {
	if errors.Is(err, gorm.ErrDuplicatedKey) {
		return true
	}

	errStr := strings.ToLower(err.Error())

	// SQLite: "UNIQUE constraint failed"
	if strings.Contains(errStr, "unique constraint failed") {
		return true
	}

	// PostgreSQL: "duplicate key" or "violates unique constraint"
	if strings.Contains(errStr, "duplicate key") {
		return true
	}
	if strings.Contains(errStr, "violates unique constraint") {
		return true
	}

	return false
}

// GetUserByEmail retrieves a user by email
func (r *Repository) GetUserByEmail(ctx context.Context, email string) (*models.User, error) {
	var model models.User
	if err := r.db.DB.WithContext(ctx).Where("email = ?", email).First(&model).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("user not found")
		}
		return nil, err
	}

	return &model, nil
}

// GetUserByUUID retrieves a user by UUID
func (r *Repository) GetUserByUUID(ctx context.Context, uuid string) (*entities.User, error) {
	var model models.User
	if err := r.db.DB.WithContext(ctx).Where("uuid = ?", uuid).First(&model).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("user not found")
		}
		return nil, err
	}

	return toEntity(model), nil
}

// toEntity converts a models.User to entities.User
func toEntity(model models.User) *entities.User {
	return &entities.User{
		UUID:      model.UUID,
		Username:  model.Username,
		Email:     model.Email,
		CreatedAt: model.CreatedAt,
		UpdatedAt: model.UpdatedAt,
	}
}
