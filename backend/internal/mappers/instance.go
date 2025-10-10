package mappers

import (
	"github.com/gardarr/gardarr/internal/entities"
	"github.com/gardarr/gardarr/internal/models"
)

func ToInstanceResponse(e *entities.Instance) models.InstanceResponse {
	if e == nil {
		return models.InstanceResponse{}
	}

	return models.InstanceResponse{
		Server: models.InstanceServerResponse{
			FreeSpaceOnDisk: e.Server.FreeSpaceOnDisk,
		},
		Application: models.InstanceApplicationResponse{
			Version:    e.Application.Version,
			APIVersion: e.Application.APIVersion,
		},
		Transfer: models.InstanceTransferResponse{
			AllTimeDownloaded:     e.Transfer.AllTimeDownloaded,
			AllTimeUploaded:       e.Transfer.AllTimeUploaded,
			GlobalRatio:           e.Transfer.GlobalRatio,
			LastExternalAddressV4: e.Transfer.LastExternalAddressV4,
			LastExternalAddressV6: e.Transfer.LastExternalAddressV6,
		},
	}
}

func ToInstance(body models.InstanceResponse) *entities.Instance {
	return &entities.Instance{
		Server: entities.InstanceServer{
			FreeSpaceOnDisk: body.Server.FreeSpaceOnDisk,
		},
		Application: entities.InstanceApplication{
			Version:    body.Application.Version,
			APIVersion: body.Application.APIVersion,
		},
		Transfer: entities.InstanceTransfer{
			AllTimeDownloaded:     body.Transfer.AllTimeDownloaded,
			AllTimeUploaded:       body.Transfer.AllTimeUploaded,
			GlobalRatio:           body.Transfer.GlobalRatio,
			LastExternalAddressV4: body.Transfer.LastExternalAddressV4,
			LastExternalAddressV6: body.Transfer.LastExternalAddressV6,
		},
	}
}
