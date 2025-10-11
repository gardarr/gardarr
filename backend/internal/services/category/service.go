package category

import (
	"context"

	"github.com/gardarr/gardarr/internal/entities"
	"github.com/gardarr/gardarr/internal/infra/database"
	"github.com/gardarr/gardarr/internal/repository/category"
)

type Service struct {
	repository *category.Repository
}

func NewService(db *database.Database) *Service {
	return &Service{
		repository: category.NewRepository(db),
	}
}

// CreateCategory creates a new category
func (s *Service) CreateCategory(ctx context.Context, cat entities.Category) (*entities.Category, error) {
	return s.repository.CreateCategory(ctx, cat)
}

// ListCategories retrieves all categories
func (s *Service) ListCategories(ctx context.Context) ([]*entities.Category, error) {
	return s.repository.ListCategories(ctx)
}

// GetCategoryByID retrieves a category by its ID
func (s *Service) GetCategoryByID(ctx context.Context, id string) (*entities.Category, error) {
	return s.repository.GetCategoryByID(ctx, id)
}

// GetCategoryByName retrieves a category by its name
func (s *Service) GetCategoryByName(ctx context.Context, name string) (*entities.Category, error) {
	return s.repository.GetCategoryByName(ctx, name)
}

// UpdateCategory updates an existing category
func (s *Service) UpdateCategory(ctx context.Context, cat entities.Category) (*entities.Category, error) {
	return s.repository.UpdateCategory(ctx, cat)
}

// DeleteCategory removes a category by ID
func (s *Service) DeleteCategory(ctx context.Context, id string) error {
	return s.repository.DeleteCategory(ctx, id)
}
