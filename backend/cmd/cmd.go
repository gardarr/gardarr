package cmd

import (
	"github.com/jfxdev/gardarr/cmd/agent"
	"github.com/jfxdev/gardarr/cmd/generate"
	"github.com/jfxdev/gardarr/cmd/service"
	"github.com/spf13/cobra"
)

var cmd = &cobra.Command{
	Use:          "gardarr",
	SilenceUsage: true,
	RunE:         service.Run,
}

func init() {
	cmd.AddCommand(generate.Command())
	cmd.AddCommand(agent.Command())
}

func Command() *cobra.Command {
	return cmd
}
