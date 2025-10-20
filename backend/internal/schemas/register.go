package schemas

import (
	"log"

	"github.com/go-playground/validator/v10"
)

// RegisterCustomValidators registers custom validation rules
func RegisterCustomValidators(v *validator.Validate) {
	if err := v.RegisterValidation("instancetype", validateInstanceType); err != nil {
		// Log error but don't fail the operation since validation is optional
		// In production, you might want to handle this differently
		log.Printf("Warning: failed to register custom validator 'instancetype': %v", err)
	}
}
