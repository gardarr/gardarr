package event_filter

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/jfxdev/gardarr/internal/constants"
	"github.com/jfxdev/gardarr/internal/entities"
	"github.com/jfxdev/gardarr/internal/infra/database"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCreateEventFilter(t *testing.T) {
	db := database.SetupTestDBWithMigrations(t)
	repo := NewRepository(db)
	ctx := context.Background()

	integrationID := uuid.New()
	filter := entities.EventFilter{
		UUID:            uuid.New(),
		IntegrationID:   integrationID,
		IntegrationType: entities.EventFilterTypeWebhook,
		StatusFilter:    []string{"completed", "seeding"},
		CategoryFilter:  []string{"movies"},
		NameTerms:       []string{"2024"},
	}

	created, err := repo.CreateEventFilter(ctx, filter)
	require.NoError(t, err)
	assert.Equal(t, filter.UUID, created.UUID)
	assert.Equal(t, filter.IntegrationID, created.IntegrationID)
	assert.Equal(t, filter.StatusFilter, created.StatusFilter)
	assert.Equal(t, filter.CategoryFilter, created.CategoryFilter)
	assert.Equal(t, filter.NameTerms, created.NameTerms)
}

func TestGetFilterByUUID(t *testing.T) {
	db := database.SetupTestDBWithMigrations(t)
	repo := NewRepository(db)
	ctx := context.Background()

	filter := entities.EventFilter{
		UUID:            uuid.New(),
		IntegrationID:   uuid.New(),
		IntegrationType: entities.EventFilterTypeWebhook,
		StatusFilter:    []string{"completed"},
	}

	_, err := repo.CreateEventFilter(ctx, filter)
	require.NoError(t, err)

	retrieved, err := repo.GetFilterByUUID(ctx, filter.UUID)
	require.NoError(t, err)
	assert.Equal(t, filter.UUID, retrieved.UUID)
	assert.Equal(t, filter.StatusFilter, retrieved.StatusFilter)
}

func TestGetFilterByIntegration(t *testing.T) {
	db := database.SetupTestDBWithMigrations(t)
	repo := NewRepository(db)
	ctx := context.Background()

	integrationID := uuid.New()
	filter := entities.EventFilter{
		UUID:            uuid.New(),
		IntegrationID:   integrationID,
		IntegrationType: entities.EventFilterTypeWebhook,
		StatusFilter:    []string{"completed"},
	}

	_, err := repo.CreateEventFilter(ctx, filter)
	require.NoError(t, err)

	retrieved, err := repo.GetFilterByIntegration(ctx, integrationID, entities.EventFilterTypeWebhook)
	require.NoError(t, err)
	assert.NotNil(t, retrieved)
	assert.Equal(t, integrationID, retrieved.IntegrationID)
}

func TestGetFilterByIntegrationNotFound(t *testing.T) {
	db := database.SetupTestDBWithMigrations(t)
	repo := NewRepository(db)
	ctx := context.Background()

	nonExistentID := uuid.New()
	retrieved, err := repo.GetFilterByIntegration(ctx, nonExistentID, entities.EventFilterTypeWebhook)
	require.NoError(t, err)
	assert.Nil(t, retrieved) // Should return nil when no filter exists
}

func TestUpdateEventFilter(t *testing.T) {
	db := database.SetupTestDBWithMigrations(t)
	repo := NewRepository(db)
	ctx := context.Background()

	filter := entities.EventFilter{
		UUID:            uuid.New(),
		IntegrationID:   uuid.New(),
		IntegrationType: entities.EventFilterTypeWebhook,
		StatusFilter:    []string{"completed"},
	}

	created, err := repo.CreateEventFilter(ctx, filter)
	require.NoError(t, err)

	// Update filter
	created.StatusFilter = []string{"completed", "seeding"}
	created.CategoryFilter = []string{"movies", "tv-shows"}

	updated, err := repo.UpdateEventFilter(ctx, *created)
	require.NoError(t, err)
	assert.Equal(t, created.StatusFilter, updated.StatusFilter)
	assert.Equal(t, created.CategoryFilter, updated.CategoryFilter)
}

func TestDeleteEventFilter(t *testing.T) {
	db := database.SetupTestDBWithMigrations(t)
	repo := NewRepository(db)
	ctx := context.Background()

	filter := entities.EventFilter{
		UUID:            uuid.New(),
		IntegrationID:   uuid.New(),
		IntegrationType: entities.EventFilterTypeWebhook,
		StatusFilter:    []string{"completed"},
	}

	_, err := repo.CreateEventFilter(ctx, filter)
	require.NoError(t, err)

	err = repo.DeleteEventFilter(ctx, filter.UUID)
	require.NoError(t, err)

	// Verify deletion
	retrieved, err := repo.GetFilterByUUID(ctx, filter.UUID)
	assert.Error(t, err)
	assert.Nil(t, retrieved)
}

func TestDeleteFiltersByIntegration(t *testing.T) {
	db := database.SetupTestDBWithMigrations(t)
	repo := NewRepository(db)
	ctx := context.Background()

	integrationID := uuid.New()
	filter := entities.EventFilter{
		UUID:            uuid.New(),
		IntegrationID:   integrationID,
		IntegrationType: entities.EventFilterTypeWebhook,
		StatusFilter:    []string{"completed"},
	}

	_, err := repo.CreateEventFilter(ctx, filter)
	require.NoError(t, err)

	err = repo.DeleteFiltersByIntegration(ctx, integrationID, entities.EventFilterTypeWebhook)
	require.NoError(t, err)

	// Verify deletion
	retrieved, err := repo.GetFilterByIntegration(ctx, integrationID, entities.EventFilterTypeWebhook)
	require.NoError(t, err)
	assert.Nil(t, retrieved)
}

func TestEventFilterEmptyArrays(t *testing.T) {
	db := database.SetupTestDBWithMigrations(t)
	repo := NewRepository(db)
	ctx := context.Background()

	filter := entities.EventFilter{
		UUID:            uuid.New(),
		IntegrationID:   uuid.New(),
		IntegrationType: entities.EventFilterTypeWebhook,
		StatusFilter:    []string{},
		CategoryFilter:  []string{},
		NameTerms:       []string{},
	}

	created, err := repo.CreateEventFilter(ctx, filter)
	require.NoError(t, err)
	assert.NotNil(t, created)
	assert.Empty(t, created.StatusFilter)
	assert.Empty(t, created.CategoryFilter)
	assert.Empty(t, created.NameTerms)
}

func TestEventFilterWithEventType(t *testing.T) {
	db := database.SetupTestDBWithMigrations(t)
	repo := NewRepository(db)
	ctx := context.Background()

	filter := entities.EventFilter{
		UUID:            uuid.New(),
		IntegrationID:   uuid.New(),
		IntegrationType: entities.EventFilterTypeWebhook,
		EventTypeFilter: constants.EventTypeTorrentAdded,
		StatusFilter:    []string{},
		CategoryFilter:  []string{},
		NameTerms:       []string{},
	}

	created, err := repo.CreateEventFilter(ctx, filter)
	require.NoError(t, err)
	assert.NotNil(t, created)
	assert.Equal(t, constants.EventTypeTorrentAdded, created.EventTypeFilter)
	assert.Empty(t, created.StatusFilter)
	assert.Empty(t, created.CategoryFilter)
	assert.Empty(t, created.NameTerms)

	// Verify it can be retrieved
	retrieved, err := repo.GetFilterByUUID(ctx, created.UUID)
	require.NoError(t, err)
	assert.Equal(t, constants.EventTypeTorrentAdded, retrieved.EventTypeFilter)
}
