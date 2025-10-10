package database

import (
	"github.com/gardarr/gardarr/pkg/env"
)

// loadConfigFromEnv loads database configuration from environment variables
func loadConfigFromEnv() *Config {
	config := &Config{
		driver:   env.Get("DATABASE_DRIVER").Default("sqlite").Value(),
		host:     env.Get("DATABASE_HOST").Default("localhost").Value(),
		port:     env.Get("DATABASE_PORT").Default("5432").Value(),
		user:     env.Get("DATABASE_USERNAME").Default("postgres").Value(),
		password: env.Get("DATABASE_PASSWORD").Default("").Value(),
		dbName:   env.Get("DATABASE_NAME").Default("seedbox_database").Value(),
		sslMode:  env.Get("DATABASE_SSL_MODE").Default("disable").Value(),
		filePath: env.Get("DATABASE_FILE_PATH").Default("./seedbox_database.db").Value(),
	}

	return config
}
