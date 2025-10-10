package models

type GeneralInformationResponseModel struct {
	ServerState  GeneralInformationServerStateResponseModel  `json:"server_state"`
	TransferInfo GeneralInformationTransferInfoResponseModel `json:"transfer_info"`
}

type GeneralInformationTransferInfoResponseModel struct {
	Upload   GeneralInformationTransferActionInfoResponseModel `json:"upload"`
	Download GeneralInformationTransferActionInfoResponseModel `json:"download"`
}

type GeneralInformationTransferActionInfoResponseModel struct {
	Speed  int `json:"speed"`
	Amount int `json:"amount"`
	Limit  int `json:"limit"`
}

type GeneralInformationServerStateResponseModel struct {
	FreeSpaceOnDisk int `json:"free_space_on_disk"`
}
