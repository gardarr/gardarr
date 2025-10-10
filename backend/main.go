package main

import (
	"os"

	"github.com/gardarr/gardarr/cmd"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load()

	if err := cmd.Command().Execute(); err != nil {
		os.Exit(1)
	}
}
