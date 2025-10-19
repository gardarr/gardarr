package password_reset

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

// CreateToken creates a new password reset token in the database
func (r *Repository) CreateToken(ctx context.Context, token, email string, expiresAt time.Time) (*entities.PasswordResetToken, error) {
	model := &models.PasswordResetToken{
		Token:     token,
		Email:     email,
		ExpiresAt: expiresAt,
	}

	if err := r.db.DB.WithContext(ctx).Create(model).Error; err != nil {
		return nil, err
	}

	return toEntity(*model), nil
}

// GetTokenByValue retrieves a password reset token by its token value
func (r *Repository) GetTokenByValue(ctx context.Context, token string) (*entities.PasswordResetToken, error) {
	var model models.PasswordResetToken
	if err := r.db.DB.WithContext(ctx).Where("token = ?", token).First(&model).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("token not found")
		}
		return nil, err
	}

	return toEntity(model), nil
}

// GetActiveTokenByEmail retrieves the most recent valid password reset token for an email
func (r *Repository) GetActiveTokenByEmail(ctx context.Context, email string) (*entities.PasswordResetToken, error) {
	var model models.PasswordResetToken
	if err := r.db.DB.WithContext(ctx).
		Where("email = ? AND expires_at > ? AND used_at IS NULL", email, time.Now()).
		Order("created_at DESC").
		First(&model).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("no active token found")
		}
		return nil, err
	}

	return toEntity(model), nil
}

// MarkTokenAsUsed marks a token as used by setting the UsedAt timestamp
func (r *Repository) MarkTokenAsUsed(ctx context.Context, tokenUUID string) error {
	now := time.Now()
	return r.db.DB.WithContext(ctx).
		Model(&models.PasswordResetToken{}).
		Where("uuid = ?", tokenUUID).
		Update("used_at", now).Error
}

// DeleteExpiredTokens removes expired tokens from the database
func (r *Repository) DeleteExpiredTokens(ctx context.Context) error {
	return r.db.DB.WithContext(ctx).
		Where("expires_at < ?", time.Now()).
		Delete(&models.PasswordResetToken{}).Error
}

// DeleteTokensByEmail removes all password reset tokens for a specific email
func (r *Repository) DeleteTokensByEmail(ctx context.Context, email string) error {
	return r.db.DB.WithContext(ctx).
		Where("email = ?", email).
		Delete(&models.PasswordResetToken{}).Error
}

// toEntity converts a models.PasswordResetToken to entities.PasswordResetToken
func toEntity(model models.PasswordResetToken) *entities.PasswordResetToken {
	return &entities.PasswordResetToken{
		UUID:      model.UUID,
		Token:     model.Token,
		Email:     model.Email,
		ExpiresAt: model.ExpiresAt,
		UsedAt:    model.UsedAt,
		CreatedAt: model.CreatedAt,
		UpdatedAt: model.UpdatedAt,
	}
}
