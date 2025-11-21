package database

import (
	"github.com/jfxdev/gardarr/internal/infra/database/migrations"
	"github.com/jfxdev/gardarr/internal/infra/migration"
)

func RunMigrations(db *Database) error {
	m := migration.NewMigrator(db.DB)
	migrations.Register(m)
	return m.Up()
}
