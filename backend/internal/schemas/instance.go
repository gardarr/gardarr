package schemas

import (
	"slices"

	"github.com/go-playground/validator/v10"
)

// InstanceCreateSchema represents the request body for creating an instance
type AgentCreateSchema struct {
	Name    string `json:"name"     binding:"required"`
	Type    string `json:"type"     binding:"required,instancetype"`
	Address string `josn:"address"  binding:"required"`
	Token   string `josn:"token"    binding:"required"`
}

var validInstanceTypes = []string{
	"qbittorrent",
}

// validateInstanceType is a custom validator function for instance types
func validateInstanceType(fl validator.FieldLevel) bool {
	instanceType := fl.Field().String()
	return slices.Contains(validInstanceTypes, instanceType)
}
