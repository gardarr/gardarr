package cmd

import (
	"github.com/gardarr/gardarr/cmd/agent"
	"github.com/gardarr/gardarr/cmd/generate"
	"github.com/gardarr/gardarr/cmd/service"
	"github.com/spf13/cobra"
)

var cmd = &cobra.Command{
	Use:          "seedbox",
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
