package models

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// StringArray is a custom type to handle []string in GORM
type StringArray []string

// Value implements the driver.Valuer interface for database storage
func (s StringArray) Value() (driver.Value, error) {
	if s == nil {
		return nil, nil
	}
	return json.Marshal(s)
}

// Scan implements the sql.Scanner interface for database retrieval
func (s *StringArray) Scan(value interface{}) error {
	if value == nil {
		*s = nil
		return nil
	}

	bytes, ok := value.([]byte)
	if !ok {
		return errors.New("failed to scan StringArray")
	}

	return json.Unmarshal(bytes, s)
}

type Category struct {
	ID          string      `gorm:"type:varchar(100);primaryKey"`
	Name        string      `gorm:"size:100;not null;uniqueIndex"`
	DefaultTags StringArray `gorm:"type:text"`
	Directories StringArray `gorm:"type:text"`
	CreatedAt   time.Time   `gorm:"autoCreateTime"`
	UpdatedAt   time.Time   `gorm:"autoUpdateTime"`
}

func (c *Category) BeforeCreate(tx *gorm.DB) (err error) {
	c.CreatedAt = time.Now()
	if c.ID == "" {
		c.ID = uuid.New().String()
	}

	return
}

func (c *Category) BeforeUpdate(tx *gorm.DB) (err error) {
	c.UpdatedAt = time.Now()
	return
}
