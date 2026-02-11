package statistics

import (
	"fmt"
	"strings"

	"github.com/jfxdev/gardarr/internal/infra/database"
	"github.com/jfxdev/gardarr/pkg/env"
)

// NewProvider creates a StatsProvider based on the STATISTICS_PROVIDER environment variable.
// NewProvider creates a StatsProvider configured from environment variables.
// It supports "filesystem" (default) and "influxdb". For the filesystem provider it uses STATISTICS_DIR (default "./data/statistics") and the supplied database. For the InfluxDB provider it reads STATISTICS_INFLUXDB_URL (default "http://localhost:8086"), STATISTICS_INFLUXDB_TOKEN (required), and STATISTICS_INFLUXDB_DATABASE (default "gardarr_stats"); an error is returned if the token is empty or if an unknown provider type is specified.
func NewProvider(db *database.Database) (StatsProvider, error) {
	providerType := strings.ToLower(env.Get("STATISTICS_PROVIDER").Default("filesystem").Value())

	switch providerType {
	case "filesystem", "fs", "":
		return NewFilesystemProvider(FilesystemProviderConfig{
			DB:      db,
			BaseDir: env.Get("STATISTICS_DIR").Default("./data/statistics").Value(),
		}), nil

	case "influxdb", "influx":
		url := env.Get("STATISTICS_INFLUXDB_URL").Default("http://localhost:8086").Value()
		token := env.Get("STATISTICS_INFLUXDB_TOKEN").Default("").Value()
		database := env.Get("STATISTICS_INFLUXDB_DATABASE").Default("gardarr_stats").Value()

		if token == "" {
			return nil, fmt.Errorf("STATISTICS_INFLUXDB_TOKEN is required when using the influxdb provider")
		}

		return NewInfluxDBProvider(InfluxDBProviderConfig{
			URL:      url,
			Token:    token,
			Database: database,
		})

	default:
		return nil, fmt.Errorf("unknown statistics provider: %q (supported: filesystem, influxdb)", providerType)
	}
}