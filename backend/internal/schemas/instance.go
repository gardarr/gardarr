package schemas

import (
	"slices"

	"github.com/go-playground/validator/v10"
)

// AgentCreateSchema represents the request body for creating an agent
type AgentCreateSchema struct {
	Name    string `json:"name"     binding:"required"`
	Type    string `json:"type"     binding:"required,instancetype"`
	Address string `json:"address"  binding:"required"`
	Token   string `json:"token"    binding:"required"`
	Icon    string `json:"icon"     binding:"omitempty,max=100"`
	Color   string `json:"color"    binding:"omitempty,max=50"`
}

// AgentUpdateSchema represents the request body for updating an agent
type AgentUpdateSchema struct {
	Name    string `json:"name"     binding:"omitempty"`
	Address string `json:"address"  binding:"omitempty"`
	Token   string `json:"token"    binding:"omitempty"`
	Icon    string `json:"icon"     binding:"omitempty,max=100"`
	Color   string `json:"color"    binding:"omitempty,max=50"`
}

var validInstanceTypes = []string{
	"qbittorrent",
}

// validateInstanceType is a custom validator function for instance types
func validateInstanceType(fl validator.FieldLevel) bool {
	instanceType := fl.Field().String()
	return slices.Contains(validInstanceTypes, instanceType)
}

// InstanceSetDownloadSpeedLimitSchema represents the request body for setting download speed limit
type InstanceSetDownloadSpeedLimitSchema struct {
	Limit int `json:"limit" binding:"required,min=0"`
}

// InstanceSetUploadSpeedLimitSchema represents the request body for setting upload speed limit
type InstanceSetUploadSpeedLimitSchema struct {
	Limit int `json:"limit" binding:"required,min=0"`
}
