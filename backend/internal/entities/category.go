package entities

type Category struct {
	ID          string
	Name        string
	DefaultTags []string
	Directories []string
}
