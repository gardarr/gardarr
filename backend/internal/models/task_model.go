package models

type TaskResponseModel struct {
	ID         string                   `json:"id"`
	Name       string                   `json:"name"`
	Hash       string                   `json:"hash"`
	State      string                   `json:"state"`
	Category   string                   `json:"category"`
	Path       string                   `json:"path"`
	Priority   int                      `json:"priority"`
	Ratio      float64                  `json:"ratio"`
	Size       int                      `json:"size"`
	Progress   float64                  `json:"progress"`
	Popularity float64                  `json:"popularity"`
	MagnetURI  string                   `json:"magnet_uri"`
	MagnetLink *TaskMagnetLinkResponse  `json:"magnet_link"`
	Pairs      TaskPairsResponse        `json:"pairs"`
	Network    TaskNetworkResponseModel `json:"network"`
	Tags       []string                 `json:"tags,omitempty"`
	Agent      *AgentResponse           `json:"agent,omitempty"`
}

type TaskMagnetLinkResponse struct {
	Hash        string   `json:"hash"`
	DisplayName string   `json:"display_name"`
	Trackers    []string `json:"trackers"`
	ExactLength string   `json:"exact_length"`
	ExactSource string   `json:"exact_source"`
}

type TaskPairsResponse struct {
	SwarmSeeders  int `json:"swarm_seeders"`
	SwarmLeechers int `json:"swarm_leechers"`
	Seeders       int `json:"seeders"`
	Leechers      int `json:"leechers"`
}

type TaskNetworkResponseModel struct {
	Download TaskDownloadResponseModel `json:"download"`
	Upload   TaskUploadResponseModel   `json:"upload"`
}

type TaskDownloadResponseModel struct {
	Speed  int `json:"speed"`
	Amount int `json:"amount"`
}

type TaskUploadResponseModel struct {
	Speed  int `json:"speed"`
	Amount int `json:"amount"`
}
