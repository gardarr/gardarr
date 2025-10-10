package generate

import (
	"github.com/gardarr/gardarr/cmd/generate/key"
	"github.com/spf13/cobra"
)

var cmd = &cobra.Command{
	Use:   "generate",
	Short: "Generate utilities for the application",
	Long:  "Generate various utilities like encryption keys, configs, etc.",
}

func init() {
	cmd.AddCommand(key.Command())
}

func Command() *cobra.Command {
	return cmd
}
