package database

import (
	"github.com/gardarr/gardarr/internal/infra/database/migrations"
	"github.com/gardarr/gardarr/internal/infra/migration"
)

func RunMigrations(db *Database) error {
	m := migration.NewMigrator(db.DB)
	migrations.Register(m)
	return m.Up()
}
