package cmd

import (
	"github.com/jfxdev/gardarr/cmd/service"
	"github.com/spf13/cobra"
)

var cmd = &cobra.Command{
	Use:          "gardarr",
	SilenceUsage: true,
	RunE:         service.Run,
}

func Command() *cobra.Command {
	return cmd
}
