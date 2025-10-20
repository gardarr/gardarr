package models

import "time"

// StatsFileIndex tracks JSONL.gz snapshot files written per agent and hour
type StatsFileIndex struct {
	ID        uint      `gorm:"primaryKey"`
	AgentID   string    `gorm:"index;size:255"`
	Date      string    `gorm:"index;size:10"` // YYYY-MM-DD
	Hour      int       `gorm:"index"`         // 0..23
	FilePath  string    `gorm:"size:512;uniqueIndex"`
	StartTS   time.Time `gorm:"index"`
	EndTS     time.Time `gorm:"index"`
	LineCount int       `gorm:"default:0"`
	SizeBytes int64     `gorm:"default:0"`
	CreatedAt time.Time `gorm:"autoCreateTime"`
	UpdatedAt time.Time `gorm:"autoUpdateTime"`
}

// StatsFileHourSummary stores quick aggregates per hour to speed up queries
type StatsFileHourSummary struct {
	ID            uint      `gorm:"primaryKey"`
	AgentID       string    `gorm:"index;size:255"`
	Date          string    `gorm:"index;size:10"`
	Hour          int       `gorm:"index"`
	TasksSeen     int       `gorm:"default:0"`
	ActiveDlCount int       `gorm:"default:0"`
	ActiveUlCount int       `gorm:"default:0"`
	TotalDlKBs    int64     `gorm:"default:0"`
	TotalUlKBs    int64     `gorm:"default:0"`
	CreatedAt     time.Time `gorm:"autoCreateTime"`
	UpdatedAt     time.Time `gorm:"autoUpdateTime"`
}
