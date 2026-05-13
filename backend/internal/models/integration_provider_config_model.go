package models

import "time"

type IntegrationProviderConfig struct {
	Provider        string    `gorm:"size:50;primaryKey"`
	Enabled         bool      `gorm:"not null;default:false"`
	EncryptedAPIKey string    `gorm:"column:encrypted_api_key;type:text"`
	CreatedAt       time.Time `gorm:"autoCreateTime"`
	UpdatedAt       time.Time `gorm:"autoUpdateTime"`
}

func (IntegrationProviderConfig) TableName() string {
	return "integration_provider_configs"
}
