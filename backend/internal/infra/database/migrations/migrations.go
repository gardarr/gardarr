package migrations

import (
	"github.com/gardarr/gardarr/internal/infra/migration"
	"github.com/gardarr/gardarr/internal/models"

	"gorm.io/gorm"
)

// Register adiciona todas as migrations no migrator
func Register(m *migration.Migrator) {
	m.RegisterMultiple([]migration.MigrationItem{
		{
			Version:     "001_create_users_table",
			Description: "Cria a tabela de usuários",
			Up: func(db *gorm.DB) error {
				return db.AutoMigrate(&models.User{})
			},
			Down: func(db *gorm.DB) error {
				return db.Migrator().DropTable(&models.User{})
			},
		},
		{
			Version:     "002_create_agents_table",
			Description: "Cria a tabela de posts vinculada a usuários",
			Up: func(db *gorm.DB) error {
				return db.AutoMigrate(&models.Agent{})
			},
			Down: func(db *gorm.DB) error {
				return db.Migrator().DropTable(&models.Agent{})
			},
		},
		{
			Version:     "003_add_role_to_users",
			Description: "Adiciona coluna role em users",
			Up: func(db *gorm.DB) error {
				type User struct {
					Role string `gorm:"size:100"`
				}
				return db.Migrator().AddColumn(&User{}, "Role")
			},
			Down: func(db *gorm.DB) error {
				type User struct{}
				return db.Migrator().DropColumn(&User{}, "Role")
			},
		},
		{
			Version:     "004_create_categories_table",
			Description: "Cria a tabela de categorias",
			Up: func(db *gorm.DB) error {
				return db.AutoMigrate(&models.Category{})
			},
			Down: func(db *gorm.DB) error {
				return db.Migrator().DropTable(&models.Category{})
			},
		},
	})
}
