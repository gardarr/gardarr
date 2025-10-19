package signup_token

import (
	"context"
	"errors"
	"time"

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

// CreateToken creates a new signup token in the database
func (r *Repository) CreateToken(ctx context.Context, token, email, role string, expiresAt time.Time) (*entities.SignupToken, error) {
	model := &models.SignupToken{
		Token:     token,
		Email:     email,
		Role:      role,
		ExpiresAt: expiresAt,
	}

	if err := r.db.DB.WithContext(ctx).Create(model).Error; err != nil {
		return nil, err
	}

	return toEntity(*model), nil
}

// GetTokenByValue retrieves a signup token by its token value
func (r *Repository) GetTokenByValue(ctx context.Context, token string) (*entities.SignupToken, error) {
	var model models.SignupToken
	if err := r.db.DB.WithContext(ctx).Where("token = ?", token).First(&model).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("token not found")
		}
		return nil, err
	}

	return toEntity(model), nil
}

// MarkTokenAsUsed marks a token as used by setting the UsedAt timestamp
func (r *Repository) MarkTokenAsUsed(ctx context.Context, tokenUUID string) error {
	now := time.Now()
	return r.db.DB.WithContext(ctx).
		Model(&models.SignupToken{}).
		Where("uuid = ?", tokenUUID).
		Update("used_at", now).Error
}

// DeleteExpiredTokens removes expired tokens from the database
func (r *Repository) DeleteExpiredTokens(ctx context.Context) error {
	return r.db.DB.WithContext(ctx).
		Where("expires_at < ?", time.Now()).
		Delete(&models.SignupToken{}).Error
}

// DeleteToken removes a token from the database by its token value
func (r *Repository) DeleteToken(ctx context.Context, token string) error {
	result := r.db.DB.WithContext(ctx).
		Where("token = ?", token).
		Delete(&models.SignupToken{})

	if result.Error != nil {
		return result.Error
	}

	if result.RowsAffected == 0 {
		return errors.New("token not found")
	}

	return nil
}

// ListTokens retrieves all signup tokens from the database
func (r *Repository) ListTokens(ctx context.Context) ([]*entities.SignupToken, error) {
	var models []models.SignupToken
	if err := r.db.DB.WithContext(ctx).Order("created_at DESC").Find(&models).Error; err != nil {
		return nil, err
	}

	tokens := make([]*entities.SignupToken, len(models))
	for i, model := range models {
		tokens[i] = toEntity(model)
	}

	return tokens, nil
}

// toEntity converts a models.SignupToken to entities.SignupToken
func toEntity(model models.SignupToken) *entities.SignupToken {
	return &entities.SignupToken{
		UUID:      model.UUID,
		Token:     model.Token,
		Email:     model.Email,
		Role:      model.Role,
		ExpiresAt: model.ExpiresAt,
		UsedAt:    model.UsedAt,
		CreatedAt: model.CreatedAt,
		UpdatedAt: model.UpdatedAt,
	}
}
