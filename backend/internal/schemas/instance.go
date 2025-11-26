package schemas

import (
	"slices"

	"github.com/go-playground/validator/v10"
)

// AgentCreateSchema represents the request body for creating an agent
type AgentCreateSchema struct {
	Name    string `json:"name"     binding:"required"`
	Type    string `json:"type"     binding:"required,instancetype"`
	Address string `json:"address"  binding:"required"`
	Token   string `json:"token"    binding:"required"`
	Icon    string `json:"icon"     binding:"omitempty,max=100"`
	Color   string `json:"color"    binding:"omitempty,max=50"`
}

// AgentUpdateSchema represents the request body for updating an agent
type AgentUpdateSchema struct {
	Name    string `json:"name"     binding:"omitempty"`
	Address string `json:"address"  binding:"omitempty"`
	Token   string `json:"token"    binding:"omitempty"`
	Icon    string `json:"icon"     binding:"omitempty,max=100"`
	Color   string `json:"color"    binding:"omitempty,max=50"`
}

var validInstanceTypes = []string{
	"qbittorrent",
}

// validateInstanceType is a custom validator function for instance types
func validateInstanceType(fl validator.FieldLevel) bool {
	instanceType := fl.Field().String()
	return slices.Contains(validInstanceTypes, instanceType)
}

// InstanceSetDownloadSpeedLimitSchema represents the request body for setting download speed limit
type InstanceSetSpeedLimitSchema struct {
	DownloadLimit int `json:"download_limit" binding:"min=-1"` // -1 for unlimited
	UploadLimit   int `json:"upload_limit" binding:"min=-1"`   // -1 for unlimited
}

// InstanceSetMaxActiveTorrentLimitsSchema represents the request body for setting max active torrent limits
type InstanceSetMaxActiveTorrentLimitsSchema struct {
	MaxActiveDownloads        int `json:"max_active_downloads" binding:"required,min=-1"`
	MaxActiveUploads          int `json:"max_active_uploads" binding:"required,min=-1"`
	MaxActiveTorrents         int `json:"max_active_torrents" binding:"required,min=-1"`
	MaxActiveCheckingTorrents int `json:"max_active_checking_torrents" binding:"required,min=-1"`
}
