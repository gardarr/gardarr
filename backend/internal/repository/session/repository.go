package session

import (
	"context"
	"errors"
	"time"

	"github.com/gardarr/gardarr/internal/entities"
	"github.com/gardarr/gardarr/internal/infra/database"
	"github.com/gardarr/gardarr/internal/models"
	"github.com/google/uuid"
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

// CreateSession inserts a new session into the database
func (r *Repository) CreateSession(ctx context.Context, userUUID uuid.UUID, token, userAgent, ipAddress string, expiresAt time.Time) (*entities.Session, error) {
	model := &models.Session{
		UserUUID:  userUUID,
		Token:     token,
		UserAgent: userAgent,
		IPAddress: ipAddress,
		ExpiresAt: expiresAt,
	}

	if err := r.db.DB.WithContext(ctx).Create(model).Error; err != nil {
		return nil, err
	}

	return toEntity(*model), nil
}

// GetSessionByToken retrieves a session by token
func (r *Repository) GetSessionByToken(ctx context.Context, token string) (*models.Session, error) {
	var model models.Session
	if err := r.db.DB.WithContext(ctx).
		Preload("User").
		Where("token = ?", token).
		First(&model).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("session not found")
		}
		return nil, err
	}

	return &model, nil
}

// GetUserSessions retrieves all sessions for a user
func (r *Repository) GetUserSessions(ctx context.Context, userUUID uuid.UUID) ([]*entities.Session, error) {
	var models []models.Session
	if err := r.db.DB.WithContext(ctx).
		Where("user_uuid = ?", userUUID).
		Where("expires_at > ?", time.Now()).
		Order("created_at DESC").
		Find(&models).Error; err != nil {
		return nil, err
	}

	result := make([]*entities.Session, len(models))
	for i, item := range models {
		result[i] = toEntity(item)
	}

	return result, nil
}

// DeleteSession removes a session by token
func (r *Repository) DeleteSession(ctx context.Context, token string) error {
	result := r.db.DB.WithContext(ctx).Where("token = ?", token).Delete(&models.Session{})
	if result.Error != nil {
		return result.Error
	}

	if result.RowsAffected == 0 {
		return errors.New("session not found")
	}

	return nil
}

// DeleteUserSessions removes all sessions for a user (logout from all devices)
func (r *Repository) DeleteUserSessions(ctx context.Context, userUUID uuid.UUID) error {
	return r.db.DB.WithContext(ctx).Where("user_uuid = ?", userUUID).Delete(&models.Session{}).Error
}

// DeleteExpiredSessions removes all expired sessions (cleanup job)
func (r *Repository) DeleteExpiredSessions(ctx context.Context) error {
	return r.db.DB.WithContext(ctx).Where("expires_at < ?", time.Now()).Delete(&models.Session{}).Error
}

// toEntity converts a models.Session to entities.Session
func toEntity(model models.Session) *entities.Session {
	return &entities.Session{
		ID:        model.ID,
		UserUUID:  model.UserUUID,
		Token:     model.Token,
		UserAgent: model.UserAgent,
		IPAddress: model.IPAddress,
		ExpiresAt: model.ExpiresAt,
		CreatedAt: model.CreatedAt,
	}
}
