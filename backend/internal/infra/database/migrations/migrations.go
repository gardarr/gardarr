package migrations

import (
	"github.com/jfxdev/gardarr/internal/infra/migration"
	"github.com/jfxdev/gardarr/internal/models"

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
			Version:     "014_create_webhooks_table",
			Description: "Cria a tabela de webhooks para integrações",
			Up: func(db *gorm.DB) error {
				return db.AutoMigrate(&models.Webhook{})
			},
			Down: func(db *gorm.DB) error {
				return db.Migrator().DropTable(&models.Webhook{})
			},
		},
		{
			Version:     "015_create_event_filters_table",
			Description: "Cria a tabela de filtros de eventos para integrações",
			Up: func(db *gorm.DB) error {
				return db.AutoMigrate(&models.EventFilter{})
			},
			Down: func(db *gorm.DB) error {
				return db.Migrator().DropTable(&models.EventFilter{})
			},
		},
		{
			Version:     "016_add_event_type_filter_column",
			Description: "Adiciona coluna event_type_filter na tabela event_filters",
			Up: func(db *gorm.DB) error {
				// Check if column already exists
				if db.Migrator().HasColumn(&models.EventFilter{}, "EventTypeFilter") {
					return nil
				}
				return db.Migrator().AddColumn(&models.EventFilter{}, "EventTypeFilter")
			},
			Down: func(db *gorm.DB) error {
				return db.Migrator().DropColumn(&models.EventFilter{}, "event_type_filter")
			},
		},
		{
			Version:     "017_create_task_states_table",
			Description: "Cria a tabela de estados de tasks para persistir estado entre reinicializações",
			Up: func(db *gorm.DB) error {
				return db.AutoMigrate(&models.TaskState{})
			},
			Down: func(db *gorm.DB) error {
				return db.Migrator().DropTable(&models.TaskState{})
			},
		},
		{
			Version:     "018_create_webhook_history_table",
			Description: "Cria a tabela de histórico de webhooks",
			Up: func(db *gorm.DB) error {
				return db.AutoMigrate(&models.WebhookHistory{})
			},
			Down: func(db *gorm.DB) error {
				return db.Migrator().DropTable(&models.WebhookHistory{})
			},
		},
	})
}
