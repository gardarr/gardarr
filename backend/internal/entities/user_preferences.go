package entities

import (
	"time"

	"github.com/google/uuid"
)

type UserPreferences struct {
	UUID                        uuid.UUID
	UserUUID                    uuid.UUID
	TorrentDisplayMode          string
	Compact                     bool
	BackgroundImageBlurIntensity int
	CreatedAt                   time.Time
	UpdatedAt                   time.Time
}
