package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Worker struct {
	UUID            uuid.UUID `gorm:"type:uuid;primaryKey;uniqueIndex"`
	Name            string    `gorm:"size:100;uniqueIndex"`
	Type            string    `gorm:"size:25"`
	Address         string    `gorm:"size:600;not null"`
	EncrypetedToken string    `gorm:"size:600;not null"`
	Icon            string    `gorm:"size:100"`
	Color           string    `gorm:"size:50"`
	CreatedAt       time.Time `gorm:"autoCreateTime"`
	UpdatedAt       time.Time `gorm:"autoUpdateTime"`
}

func (a *Worker) TableName() string {
	return "workers"
}

func (a *Worker) BeforeCreate(tx *gorm.DB) (err error) {
	a.CreatedAt = time.Now()
	if a.UUID == uuid.Nil {
		a.UUID = uuid.New()
	}

	return
}

func (a *Worker) BeforeUpdate(tx *gorm.DB) (err error) {
	a.UpdatedAt = time.Now()
	return
}

type WorkerResponse struct {
	UUID      string           `json:"uuid"`
	Name      string           `json:"name"`
	Address   string           `json:"address"`
	Status    string           `json:"status"`
	Error     string           `json:"error,omitempty"`
	ErrorCode string           `json:"error_code,omitempty"`
	Permanent bool             `json:"permanent,omitempty"`
	Icon      string           `json:"icon,omitempty"`
	Color     string           `json:"color,omitempty"`
	Instance  InstanceResponse `json:"instance"`
}

type WorkerVersionResponse struct {
	Version        string `json:"version"`
	Commit         string `json:"commit"`
	Date           string `json:"date"`
	QbittorrentURL string `json:"qbittorrent_url,omitempty"`
}

type WorkerLivenessResponse struct {
	Status    string `json:"status"`
	ErrorCode string `json:"error_code,omitempty"`
	Message   string `json:"message,omitempty"`
	Permanent bool   `json:"permanent,omitempty"`
}
