package cmd

import (
	"github.com/jfxdev/gardarr/cmd/generate"
	"github.com/jfxdev/gardarr/cmd/service"
	"github.com/jfxdev/gardarr/cmd/worker"
	"github.com/spf13/cobra"
)

var cmd = &cobra.Command{
	Use:          "gardarr",
	SilenceUsage: true,
	RunE:         service.Run,
}

func init() {
	cmd.AddCommand(generate.Command())
	cmd.AddCommand(worker.Command())
}

func Command() *cobra.Command {
	return cmd
}
