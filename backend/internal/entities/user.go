package entities

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	UUID      uuid.UUID
	Founder   bool
	Username  string
	Email     string
	Role      string
	CreatedAt time.Time
	UpdatedAt time.Time
}
