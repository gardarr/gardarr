package user

import (
	"context"
	"errors"
	"strings"

	"github.com/gardarr/gardarr/internal/entities"
	"github.com/gardarr/gardarr/internal/infra/database"
	"github.com/gardarr/gardarr/internal/mappers"
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

// CreateUser inserts a new user into the database with default role 'user'
func (r *Repository) CreateUser(ctx context.Context, email, passwordHash, salt string) (*entities.User, error) {
	return r.CreateUserWithRole(ctx, email, passwordHash, salt, "user", false)
}

// CreateUserWithRole inserts a new user into the database with a specific role
func (r *Repository) CreateUserWithRole(ctx context.Context, email, passwordHash, salt, role string, founder bool) (*entities.User, error) {
	model := &models.User{
		Email:        email,
		PasswordHash: passwordHash,
		Salt:         salt,
		Role:         role,
		Founder:      founder,
	}

	if err := r.db.DB.WithContext(ctx).Create(model).Error; err != nil {
		if isDuplicateKeyError(err) {
			return nil, errors.New("user with this email already exists")
		}
		return nil, err
	}

	return mappers.ToUser(*model), nil
}

// CountUsers returns the total number of users in the database
func (r *Repository) CountUsers(ctx context.Context) (int64, error) {
	var count int64
	if err := r.db.DB.WithContext(ctx).Model(&models.User{}).Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
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

	return mappers.ToUser(model), nil
}

// ListUsers retrieves all users from the database
func (r *Repository) ListUsers(ctx context.Context) ([]*entities.User, error) {
	var models []models.User
	if err := r.db.DB.WithContext(ctx).Order("created_at DESC").Find(&models).Error; err != nil {
		return nil, err
	}

	users := make([]*entities.User, len(models))
	for i, model := range models {
		users[i] = mappers.ToUser(model)
	}

	return users, nil
}

// UpdateUserRole updates the role of a user
func (r *Repository) UpdateUserRole(ctx context.Context, uuid, role string) error {
	return r.db.DB.WithContext(ctx).
		Model(&models.User{}).
		Where("uuid = ?", uuid).
		Update("role", role).Error
}

// UpdatePassword updates the password hash and salt for a user
func (r *Repository) UpdatePassword(ctx context.Context, email, passwordHash, salt string) error {
	result := r.db.DB.WithContext(ctx).
		Model(&models.User{}).
		Where("email = ?", email).
		Updates(map[string]interface{}{
			"password_hash": passwordHash,
			"salt":          salt,
		})

	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("user not found")
	}
	return nil
}

// DeleteUser deletes a user from the database by UUID
func (r *Repository) DeleteUser(ctx context.Context, uuid string) error {
	result := r.db.DB.WithContext(ctx).Where("uuid = ?", uuid).Delete(&models.User{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("user not found")
	}
	return nil
}
