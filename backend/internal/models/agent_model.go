package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Agent struct {
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

func (a *Agent) BeforeCreate(tx *gorm.DB) (err error) {
	a.CreatedAt = time.Now()
	if a.UUID == uuid.Nil {
		a.UUID = uuid.New()
	}

	return
}

func (a *Agent) BeforeUpdate(tx *gorm.DB) (err error) {
	a.UpdatedAt = time.Now()
	return
}

type AgentResponse struct {
	UUID       string           `json:"uuid"`
	Name       string           `json:"name"`
	Address    string           `json:"address"`
	Status     string           `json:"status"`
	Error      string           `json:"error,omitempty"`
	Icon       string           `json:"icon,omitempty"`
	Color      string           `json:"color,omitempty"`
	Standalone bool             `json:"standalone,omitempty"`
	Instance   InstanceResponse `json:"instance"`
}

type AgentVersionResponse struct {
	Version string `json:"version"`
	Commit  string `json:"commit"`
	Date    string `json:"date"`
}

type AgentLivenessResponse struct {
	Status string `json:"status"`
}
