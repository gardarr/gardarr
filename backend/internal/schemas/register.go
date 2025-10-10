package schemas

import "github.com/go-playground/validator/v10"

// RegisterCustomValidators registers custom validation rules
func RegisterCustomValidators(v *validator.Validate) {
	v.RegisterValidation("instancetype", validateInstanceType)
}
