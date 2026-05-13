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
				return db.AutoMigrate(&models.Worker{})
			},
			Down: func(db *gorm.DB) error {
				return db.Migrator().DropTable(&models.Worker{})
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
			Version:     "018_migrate_display_mode_default_to_table",
			Description: "Updates user preferences display mode from 'default' to 'table'",
			Up: func(db *gorm.DB) error {
				// Update all existing records with 'default' to 'table'
				return db.Model(&models.UserPreferences{}).
					Where("torrent_display_mode = ?", "default").
					Update("torrent_display_mode", "table").Error
			},
			Down: func(db *gorm.DB) error {
				// No-op: reverting torrent_display_mode changes is intentionally disabled.
				// Rolling back would overwrite user-set preferences (table/card/list) with "default",
				// which is destructive and irreversible. Users who manually changed their display
				// mode would lose their preference.
				return nil
			},
		},
		{
			Version:     "019_create_webhook_history_table",
			Description: "Cria a tabela de histórico de webhooks",
			Up: func(db *gorm.DB) error {
				return db.AutoMigrate(&models.WebhookHistory{})
			},
			Down: func(db *gorm.DB) error {
				return db.Migrator().DropTable(&models.WebhookHistory{})
			},
		},
		{
			Version:     "020_add_color_palettes_to_user_preferences",
			Description: "Adiciona colunas de paletas de cores customizáveis nas preferências do usuário",
			Up: func(db *gorm.DB) error {
				// Add color palette columns if they don't exist
				if !db.Migrator().HasColumn(&models.UserPreferences{}, "ColorPalette1Primary") {
					if err := db.Migrator().AddColumn(&models.UserPreferences{}, "ColorPalette1Primary"); err != nil {
						return err
					}
				}
				if !db.Migrator().HasColumn(&models.UserPreferences{}, "ColorPalette1Secondary") {
					if err := db.Migrator().AddColumn(&models.UserPreferences{}, "ColorPalette1Secondary"); err != nil {
						return err
					}
				}
				if !db.Migrator().HasColumn(&models.UserPreferences{}, "ColorPalette1Accent") {
					if err := db.Migrator().AddColumn(&models.UserPreferences{}, "ColorPalette1Accent"); err != nil {
						return err
					}
				}
				if !db.Migrator().HasColumn(&models.UserPreferences{}, "ColorPalette2Primary") {
					if err := db.Migrator().AddColumn(&models.UserPreferences{}, "ColorPalette2Primary"); err != nil {
						return err
					}
				}
				if !db.Migrator().HasColumn(&models.UserPreferences{}, "ColorPalette2Secondary") {
					if err := db.Migrator().AddColumn(&models.UserPreferences{}, "ColorPalette2Secondary"); err != nil {
						return err
					}
				}
				if !db.Migrator().HasColumn(&models.UserPreferences{}, "ColorPalette2Accent") {
					if err := db.Migrator().AddColumn(&models.UserPreferences{}, "ColorPalette2Accent"); err != nil {
						return err
					}
				}
				if !db.Migrator().HasColumn(&models.UserPreferences{}, "ColorPalette3Primary") {
					if err := db.Migrator().AddColumn(&models.UserPreferences{}, "ColorPalette3Primary"); err != nil {
						return err
					}
				}
				if !db.Migrator().HasColumn(&models.UserPreferences{}, "ColorPalette3Secondary") {
					if err := db.Migrator().AddColumn(&models.UserPreferences{}, "ColorPalette3Secondary"); err != nil {
						return err
					}
				}
				if !db.Migrator().HasColumn(&models.UserPreferences{}, "ColorPalette3Accent") {
					if err := db.Migrator().AddColumn(&models.UserPreferences{}, "ColorPalette3Accent"); err != nil {
						return err
					}
				}
				return nil
			},
			Down: func(db *gorm.DB) error {
				// Remove color palette columns
				columns := []string{
					"color_palette_1_primary", "color_palette_1_secondary", "color_palette_1_accent",
					"color_palette_2_primary", "color_palette_2_secondary", "color_palette_2_accent",
					"color_palette_3_primary", "color_palette_3_secondary", "color_palette_3_accent",
				}
				for _, col := range columns {
					if err := db.Migrator().DropColumn(&models.UserPreferences{}, col); err != nil {
						return err
					}
				}
				return nil
			},
		},
		{
			Version:     "021_add_active_color_palette_to_user_preferences",
			Description: "Adiciona coluna para selecionar a paleta de cores ativa (1, 2 ou 3)",
			Up: func(db *gorm.DB) error {
				// Add active_color_palette column if it doesn't exist
				if !db.Migrator().HasColumn(&models.UserPreferences{}, "ActiveColorPalette") {
					if err := db.Migrator().AddColumn(&models.UserPreferences{}, "ActiveColorPalette"); err != nil {
						return err
					}
				}
				// Set default value to 1 for existing records
				return db.Model(&models.UserPreferences{}).Where("active_color_palette = ?", 0).Update("active_color_palette", 1).Error
			},
			Down: func(db *gorm.DB) error {
				return db.Migrator().DropColumn(&models.UserPreferences{}, "active_color_palette")
			},
		},
		{
			Version:     "022_add_muted_color_to_palettes",
			Description: "Adiciona a 4ª cor (muted) para cada paleta customizada",
			Up: func(db *gorm.DB) error {
				// Add muted color for palette 1
				if !db.Migrator().HasColumn(&models.UserPreferences{}, "ColorPalette1Muted") {
					if err := db.Migrator().AddColumn(&models.UserPreferences{}, "ColorPalette1Muted"); err != nil {
						return err
					}
				}
				// Add muted color for palette 2
				if !db.Migrator().HasColumn(&models.UserPreferences{}, "ColorPalette2Muted") {
					if err := db.Migrator().AddColumn(&models.UserPreferences{}, "ColorPalette2Muted"); err != nil {
						return err
					}
				}
				// Add muted color for palette 3
				if !db.Migrator().HasColumn(&models.UserPreferences{}, "ColorPalette3Muted") {
					if err := db.Migrator().AddColumn(&models.UserPreferences{}, "ColorPalette3Muted"); err != nil {
						return err
					}
				}
				return nil
			},
			Down: func(db *gorm.DB) error {
				// Remove muted columns
				columns := []string{
					"color_palette_1_muted",
					"color_palette_2_muted",
					"color_palette_3_muted",
				}
				for _, col := range columns {
					if err := db.Migrator().DropColumn(&models.UserPreferences{}, col); err != nil {
						return err
					}
				}
				return nil
			},
		},
		{
			Version:     "023_rename_agents_to_workers",
			Description: "Renomeia tabela agents para workers e colunas agent_id para worker_id",
			Up: func(db *gorm.DB) error {
				if db.Migrator().HasTable("agents") {
					if err := db.Migrator().RenameTable("agents", "workers"); err != nil {
						return err
					}
				}
				if db.Migrator().HasColumn(&models.Event{}, "agent_id") {
					if err := db.Migrator().RenameColumn(&models.Event{}, "agent_id", "worker_id"); err != nil {
						return err
					}
				}
				if db.Migrator().HasColumn(&models.TaskState{}, "agent_id") {
					if err := db.Migrator().RenameColumn(&models.TaskState{}, "agent_id", "worker_id"); err != nil {
						return err
					}
				}
				return nil
			},
			Down: func(db *gorm.DB) error {
				if db.Migrator().HasTable("workers") {
					if err := db.Migrator().RenameTable("workers", "agents"); err != nil {
						return err
					}
				}
				if db.Migrator().HasColumn(&models.Event{}, "worker_id") {
					if err := db.Migrator().RenameColumn(&models.Event{}, "worker_id", "agent_id"); err != nil {
						return err
					}
				}
				if db.Migrator().HasColumn(&models.TaskState{}, "worker_id") {
					if err := db.Migrator().RenameColumn(&models.TaskState{}, "worker_id", "agent_id"); err != nil {
						return err
					}
				}
				return nil
			},
		},
		{
			Version:     "024_remove_standalone_worker",
			Description: "Remove worker standalone do banco de dados (se existir)",
			Up: func(db *gorm.DB) error {
				return db.Where("uuid = ?", "00000000-0000-0000-0000-000000000000").Delete(&models.Worker{}).Error
			},
			Down: func(db *gorm.DB) error {
				// No-op: não queremos recriar o worker se fizer rollback
				return nil
			},
		},
		{
			Version:     "025_add_tgdb_metadata_to_task_metadata",
			Description: "Adiciona as colunas name e release_date na tabela task_metadata",
			Up: func(db *gorm.DB) error {
				if !db.Migrator().HasColumn(&models.TaskMetadata{}, "Name") {
					if err := db.Migrator().AddColumn(&models.TaskMetadata{}, "Name"); err != nil {
						return err
					}
				}
				if !db.Migrator().HasColumn(&models.TaskMetadata{}, "ReleaseDate") {
					if err := db.Migrator().AddColumn(&models.TaskMetadata{}, "ReleaseDate"); err != nil {
						return err
					}
				}
				return nil
			},
			Down: func(db *gorm.DB) error {
				if err := db.Migrator().DropColumn(&models.TaskMetadata{}, "name"); err != nil {
					return err
				}
				if err := db.Migrator().DropColumn(&models.TaskMetadata{}, "release_date"); err != nil {
					return err
				}
				return nil
			},
		},
		{
			Version:     "026_seed_default_categories",
			Description: "Popula categorias padrão do sistema sem sobrescrever categorias existentes",
			Up: func(db *gorm.DB) error {
				defaultCategories := []models.Category{
					{Name: "Movies", Color: "#ef4444", Icon: "Film"},
					{Name: "Shows", Color: "#3b82f6", Icon: "Tv"},
					{Name: "Games", Color: "#10b981", Icon: "Gamepad2"},
					{Name: "Other", Color: "#6b7280", Icon: "Folder"},
					{Name: "Books", Color: "#f59e0b", Icon: "BookOpen"},
					{Name: "Anime", Color: "#ec4899", Icon: "Star"},
					{Name: "Music", Color: "#14b8a6", Icon: "Music"},
				}

				for _, category := range defaultCategories {
					var existingCount int64
					if err := db.Table("categories").Where("name = ?", category.Name).Count(&existingCount).Error; err != nil {
						return err
					}

					if existingCount > 0 {
						continue
					}

					if err := db.Create(&category).Error; err != nil {
						return err
					}
				}

				return nil
			},
			Down: func(db *gorm.DB) error {
				// No-op: rollback não deve remover categorias que podem já estar em uso.
				return nil
			},
		},
		{
			Version:     "027_rename_category_directory_and_add_metadata_source",
			Description: "Renomeia directory para default_directory e adiciona metadata_source em categories",
			Up: func(db *gorm.DB) error {
				if db.Migrator().HasColumn(&models.Category{}, "directory") && !db.Migrator().HasColumn(&models.Category{}, "default_directory") {
					if err := db.Migrator().RenameColumn(&models.Category{}, "directory", "default_directory"); err != nil {
						return err
					}
				}

				if !db.Migrator().HasColumn(&models.Category{}, "MetadataSource") {
					if err := db.Migrator().AddColumn(&models.Category{}, "MetadataSource"); err != nil {
						return err
					}
				}

				return db.Table("categories").
					Where("metadata_source = '' OR metadata_source IS NULL").
					Update("metadata_source", "none").Error
			},
			Down: func(db *gorm.DB) error {
				if db.Migrator().HasColumn(&models.Category{}, "default_directory") && !db.Migrator().HasColumn(&models.Category{}, "directory") {
					if err := db.Migrator().RenameColumn(&models.Category{}, "default_directory", "directory"); err != nil {
						return err
					}
				}

				if db.Migrator().HasColumn(&models.Category{}, "metadata_source") {
					if err := db.Migrator().DropColumn(&models.Category{}, "metadata_source"); err != nil {
						return err
					}
				}

				return nil
			},
		},
		{
			Version:     "028_create_integration_provider_configs_table",
			Description: "Cria tabela de configuração de providers de integração",
			Up: func(db *gorm.DB) error {
				return db.AutoMigrate(&models.IntegrationProviderConfig{})
			},
			Down: func(db *gorm.DB) error {
				return db.Migrator().DropTable(&models.IntegrationProviderConfig{})
			},
		},
		{
			Version:     "029_add_direct_qbittorrent_credentials_to_workers",
			Description: "Adiciona credenciais diretas do qBittorrent aos workers",
			Up: func(db *gorm.DB) error {
				if !db.Migrator().HasColumn(&models.Worker{}, "EncryptedQBittorrentURL") {
					if err := db.Migrator().AddColumn(&models.Worker{}, "EncryptedQBittorrentURL"); err != nil {
						return err
					}
				}
				if !db.Migrator().HasColumn(&models.Worker{}, "EncryptedQBittorrentUsername") {
					if err := db.Migrator().AddColumn(&models.Worker{}, "EncryptedQBittorrentUsername"); err != nil {
						return err
					}
				}
				if !db.Migrator().HasColumn(&models.Worker{}, "EncryptedQBittorrentPassword") {
					if err := db.Migrator().AddColumn(&models.Worker{}, "EncryptedQBittorrentPassword"); err != nil {
						return err
					}
				}

				return nil
			},
			Down: func(db *gorm.DB) error {
				if db.Migrator().HasColumn(&models.Worker{}, "encrypted_q_bittorrent_password") {
					if err := db.Migrator().DropColumn(&models.Worker{}, "EncryptedQBittorrentPassword"); err != nil {
						return err
					}
				}
				if db.Migrator().HasColumn(&models.Worker{}, "encrypted_q_bittorrent_username") {
					if err := db.Migrator().DropColumn(&models.Worker{}, "EncryptedQBittorrentUsername"); err != nil {
						return err
					}
				}
				if db.Migrator().HasColumn(&models.Worker{}, "encrypted_q_bittorrent_url") {
					if err := db.Migrator().DropColumn(&models.Worker{}, "EncryptedQBittorrentURL"); err != nil {
						return err
					}
				}

				return nil
			},
		},
	})
}
