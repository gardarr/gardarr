package entities

import (
	"time"

	"github.com/google/uuid"
)

type Session struct {
	ID        uuid.UUID
	UserUUID  uuid.UUID
	Token     string
	UserAgent string
	IPAddress string
	ExpiresAt time.Time
	CreatedAt time.Time
}
