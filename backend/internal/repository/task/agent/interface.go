package task

import (
	"github.com/gardarr/gardarr/internal/entities"
	"github.com/gardarr/gardarr/internal/schemas"
)

// RepositoryInterface defines the interface for task repository operations
type RepositoryInterface interface {
	List() ([]*entities.Task, error)
	Get(hash string) (*entities.Task, error)
	Add(schema schemas.TaskCreateSchema) (*entities.Task, error)
	Stop(hash string) error
	Start(hash string) error
	ForceResume(hash string) error
	Delete(id string, deleteFiles bool) error
	SetTags(hash string, tags []string) error
	SetShareLimit(schema schemas.TaskSetShareLimitSchema) error
	SetLocation(hash string, schema schemas.TaskSetLocationSchema) error
	Rename(hash string, schema schemas.TaskRenameSchema) error
	SetSuperSeeding(hash string, schema schemas.TaskSuperSeedingSchema) error
	ForceRecheck(hash string) error
	ForceReannounce(hash string) error
	SetDownloadLimit(hash string, schema schemas.TaskSetDownloadLimitSchema) error
	SetUploadLimit(hash string, schema schemas.TaskSetUploadLimitSchema) error
	ListFiles(hash string) ([]*entities.TaskFile, error)
}
