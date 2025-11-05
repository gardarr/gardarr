package entities

import "time"

type Settings struct {
	ID              string
	Timezone        string
	DefaultTheme    string
	DefaultLanguage string
	CreatedAt       time.Time
	UpdatedAt       time.Time
}
