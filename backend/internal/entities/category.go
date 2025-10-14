package entities

import "time"

type Category struct {
	ID          string
	Name        string
	DefaultTags []string
	Directories []string
	Color       string // Optional color for frontend display
	Icon        string // Optional icon for frontend display
	CreatedAt   time.Time
	UpdatedAt   time.Time
}
