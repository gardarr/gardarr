package entities

import "time"

type IntegrationProviderConfig struct {
	Provider        string
	Enabled         bool
	EncryptedAPIKey string
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

type IntegrationProviderConfigSummary struct {
	Provider         string
	Enabled          bool
	APIKeyConfigured bool
	UpdatedAt        time.Time
}
