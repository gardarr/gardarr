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
		{
			Version:     "005_add_user_auth_fields",
			Description: "Adiciona campos de email, password_hash e salt na tabela users",
			Up: func(db *gorm.DB) error {
				// Add columns
				if err := db.Migrator().AddColumn(&models.User{}, "Email"); err != nil {
					return err
				}
				if err := db.Migrator().AddColumn(&models.User{}, "PasswordHash"); err != nil {
					return err
				}
				if err := db.Migrator().AddColumn(&models.User{}, "Salt"); err != nil {
					return err
				}

				// Create unique index on email using GORM (portable across databases)
				return db.Migrator().CreateIndex(&models.User{}, "Email")
			},
			Down: func(db *gorm.DB) error {
				// Drop index
				if err := db.Migrator().DropIndex(&models.User{}, "Email"); err != nil {
					return err
				}

				// Drop columns
				if err := db.Migrator().DropColumn(&models.User{}, "Email"); err != nil {
					return err
				}
				if err := db.Migrator().DropColumn(&models.User{}, "PasswordHash"); err != nil {
					return err
				}
				return db.Migrator().DropColumn(&models.User{}, "Salt")
			},
		},
		{
			Version:     "006_create_sessions_table",
			Description: "Cria a tabela de sessões",
			Up: func(db *gorm.DB) error {
				return db.AutoMigrate(&models.Session{})
			},
			Down: func(db *gorm.DB) error {
				return db.Migrator().DropTable(&models.Session{})
			},
		},
	})
}
