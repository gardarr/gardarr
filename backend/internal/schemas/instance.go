package schemas

import (
	"slices"

	"github.com/go-playground/validator/v10"
)

// WorkerCreateSchema represents the request body for creating a worker
type WorkerCreateSchema struct {
	Name     string `json:"name"     binding:"required"`
	Type     string `json:"type"     binding:"omitempty,instancetype"`
	URL      string `json:"url"      binding:"required,url"`
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
	Icon     string `json:"icon"     binding:"omitempty,max=100"`
	Color    string `json:"color"    binding:"omitempty,max=50"`
}

// WorkerUpdateSchema represents the request body for updating a worker
type WorkerUpdateSchema struct {
	Name     string `json:"name"     binding:"omitempty"`
	URL      string `json:"url"      binding:"omitempty,url"`
	Username string `json:"username" binding:"omitempty"`
	Password string `json:"password" binding:"omitempty"`
	Icon     string `json:"icon"     binding:"omitempty,max=100"`
	Color    string `json:"color"    binding:"omitempty,max=50"`
}

var validInstanceTypes = []string{
	"qbittorrent",
}

// validateInstanceType is a custom validator function for instance types
func validateInstanceType(fl validator.FieldLevel) bool {
	instanceType := fl.Field().String()
	return slices.Contains(validInstanceTypes, instanceType)
}

// InstanceSetSpeedLimitSchema represents the request body for setting download speed limit
type InstanceSetSpeedLimitSchema struct {
	DownloadLimit int `json:"download_limit" binding:"required,min=1"`
	UploadLimit   int `json:"upload_limit" binding:"required,min=1"`
}

// InstanceSetMaxActiveTorrentLimitsSchema represents the request body for setting max active torrent limits
type InstanceSetMaxActiveTorrentLimitsSchema struct {
	MaxActiveDownloads        int `json:"max_active_downloads" binding:"required,min=-1"`
	MaxActiveUploads          int `json:"max_active_uploads" binding:"required,min=-1"`
	MaxActiveTorrents         int `json:"max_active_torrents" binding:"required,min=-1"`
	MaxActiveCheckingTorrents int `json:"max_active_checking_torrents" binding:"required,min=-1"`
}
