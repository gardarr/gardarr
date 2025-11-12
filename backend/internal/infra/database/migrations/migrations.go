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
			Version:     "001_create_signup_tokens_table",
			Description: "Cria a tabela de tokens de signup (magic links)",
			Up: func(db *gorm.DB) error {
				return db.AutoMigrate(&models.SignupToken{})
			},
			Down: func(db *gorm.DB) error {
				return db.Migrator().DropTable(&models.SignupToken{})
			},
		},
		{
			Version:     "002_create_sessions_table",
			Description: "Cria a tabela de sessões",
			Up: func(db *gorm.DB) error {
				return db.AutoMigrate(&models.Session{})
			},
			Down: func(db *gorm.DB) error {
				return db.Migrator().DropTable(&models.Session{})
			},
		},
		{
			Version:     "003_create_users_table",
			Description: "Cria a tabela de usuários",
			Up: func(db *gorm.DB) error {
				return db.AutoMigrate(&models.User{})
			},
			Down: func(db *gorm.DB) error {
				return db.Migrator().DropTable(&models.User{})
			},
		},
		{
			Version:     "004_create_agents_table",
			Description: "Cria a tabela de agents",
			Up: func(db *gorm.DB) error {
				return db.AutoMigrate(&models.Agent{})
			},
			Down: func(db *gorm.DB) error {
				return db.Migrator().DropTable(&models.Agent{})
			},
		},
		{
			Version:     "005_create_categories_table",
			Description: "Cria a tabela de categorias",
			Up: func(db *gorm.DB) error {
				return db.AutoMigrate(&models.Category{})
			},
			Down: func(db *gorm.DB) error {
				return db.Migrator().DropTable(&models.Category{})
			},
		},
		{
			Version:     "006_create_password_reset_tokens_table",
			Description: "Cria a tabela de tokens de recuperação de senha",
			Up: func(db *gorm.DB) error {
				return db.AutoMigrate(&models.PasswordResetToken{})
			},
			Down: func(db *gorm.DB) error {
				return db.Migrator().DropTable(&models.PasswordResetToken{})
			},
		},
		{
			Version:     "007_create_statistics_indexes",
			Description: "Cria tabelas de índice para arquivos JSONL de estatísticas",
			Up: func(db *gorm.DB) error {
				if err := db.AutoMigrate(&models.StatsFileIndex{}); err != nil {
					return err
				}
				if err := db.AutoMigrate(&models.StatsFileHourSummary{}); err != nil {
					return err
				}
				return nil
			},
			Down: func(db *gorm.DB) error {
				if err := db.Migrator().DropTable(&models.StatsFileHourSummary{}); err != nil {
					return err
				}
				if err := db.Migrator().DropTable(&models.StatsFileIndex{}); err != nil {
					return err
				}
				return nil
			},
		},
		{
			Version:     "008_create_settings_table",
			Description: "Cria a tabela de configurações do sistema",
			Up: func(db *gorm.DB) error {
				return db.AutoMigrate(&models.Settings{})
			},
			Down: func(db *gorm.DB) error {
				return db.Migrator().DropTable(&models.Settings{})
			},
		},
		{
			Version:     "009_create_events_table",
			Description: "Cria a tabela de eventos para histórico de mudanças de estado",
			Up: func(db *gorm.DB) error {
				return db.AutoMigrate(&models.Event{})
			},
			Down: func(db *gorm.DB) error {
				return db.Migrator().DropTable(&models.Event{})
			},
		},
		{
			Version:     "010_create_task_metadata_table",
			Description: "Cria a tabela de metadados de tasks com suporte a imagens",
			Up: func(db *gorm.DB) error {
				return db.AutoMigrate(&models.TaskMetadata{})
			},
			Down: func(db *gorm.DB) error {
				return db.Migrator().DropTable(&models.TaskMetadata{})
			},
		},
		{
			Version:     "011_add_image_position_to_task_metadata",
			Description: "Adiciona coluna image_position_y para controlar posicionamento vertical da imagem",
			Up: func(db *gorm.DB) error {
				// Add column if it doesn't exist
				if !db.Migrator().HasColumn(&models.TaskMetadata{}, "image_position_y") {
					return db.Migrator().AddColumn(&models.TaskMetadata{}, "image_position_y")
				}
				return nil
			},
			Down: func(db *gorm.DB) error {
				return db.Migrator().DropColumn(&models.TaskMetadata{}, "image_position_y")
			},
		},
		{
			Version:     "012_add_image_opacity_to_task_metadata",
			Description: "Adiciona coluna image_opacity para controlar opacidade da imagem",
			Up: func(db *gorm.DB) error {
				// Add column if it doesn't exist
				if !db.Migrator().HasColumn(&models.TaskMetadata{}, "image_opacity") {
					return db.Migrator().AddColumn(&models.TaskMetadata{}, "image_opacity")
				}
				return nil
			},
			Down: func(db *gorm.DB) error {
				return db.Migrator().DropColumn(&models.TaskMetadata{}, "image_opacity")
			},
		},
		{
			Version:     "013_create_user_preferences_table",
			Description: "Cria a tabela de preferências de usuário",
			Up: func(db *gorm.DB) error {
				return db.AutoMigrate(&models.UserPreferences{})
			},
			Down: func(db *gorm.DB) error {
				return db.Migrator().DropTable(&models.UserPreferences{})
			},
		},
		{
			Version:     "014_add_compact_to_user_preferences",
			Description: "Adiciona coluna compact para controlar visualização compacta",
			Up: func(db *gorm.DB) error {
				// Add column if it doesn't exist
				if !db.Migrator().HasColumn(&models.UserPreferences{}, "compact") {
					return db.Migrator().AddColumn(&models.UserPreferences{}, "compact")
				}
				return nil
			},
			Down: func(db *gorm.DB) error {
				return db.Migrator().DropColumn(&models.UserPreferences{}, "compact")
			},
		},
		{
			Version:     "015_add_background_image_blur_intensity",
			Description: "Adiciona coluna background_image_blur_intensity para controlar intensidade do blur",
			Up: func(db *gorm.DB) error {
				// Add column if it doesn't exist
				if !db.Migrator().HasColumn(&models.UserPreferences{}, "background_image_blur_intensity") {
					return db.Migrator().AddColumn(&models.UserPreferences{}, "background_image_blur_intensity")
				}
				return nil
			},
			Down: func(db *gorm.DB) error {
				return db.Migrator().DropColumn(&models.UserPreferences{}, "background_image_blur_intensity")
			},
		},
	})
}
