# Logger Package

Structured logging system using Go's standard `log/slog` package with configurable log levels via environment variables.

## Features

- **Structured JSON logging** using `log/slog`
- **Configurable log level** via `LOG_LEVEL` environment variable
- **Default to Info level** when not configured
- **Case-insensitive** log level parsing
- **Multiple log levels**: TRACE, DEBUG, INFO, WARN/WARNING, ERROR
- **Simple API** for quick logging
- **Context-aware logging** with `With()` method
- **GORM integration** with automatic SQL query logging in TRACE mode

## Configuration

Set the log level using the `LOG_LEVEL` environment variable:

```bash
# In .env file or environment
LOG_LEVEL=TRACE    # Show all logs including SQL queries
LOG_LEVEL=DEBUG    # Show Debug, Info, Warn, and Error
LOG_LEVEL=INFO     # Show Info, Warn, and Error (default)
LOG_LEVEL=WARN     # Show Warn and Error only
LOG_LEVEL=ERROR    # Show Error only
```

If `LOG_LEVEL` is not set or is invalid, it defaults to **INFO**.

### GORM SQL Query Logging

When `LOG_LEVEL=TRACE` is set, the logger automatically enables SQL query logging for GORM operations. This is useful for debugging database issues without cluttering logs in production environments.

## Usage

### Basic Logging

```go
package main

import "github.com/jfxdev/gardarr/pkg/logger"

func main() {
    // Simple logging
    logger.Trace("Trace message - very detailed")
    logger.Debug("Debug message")
    logger.Info("Application started")
    logger.Warn("This is a warning")
    logger.Error("An error occurred")
}
```

### Structured Logging with Attributes

```go
package main

import "github.com/jfxdev/gardarr/pkg/logger"

func main() {
    // Log with structured attributes
    logger.Info("User logged in", 
        "user_id", 12345,
        "username", "john_doe",
        "ip", "192.168.1.1")
    
    logger.Error("Database connection failed",
        "error", err,
        "host", "localhost",
        "port", 5432)
}
```

### Context-Aware Logging

```go
package main

import "github.com/jfxdev/gardarr/pkg/logger"

func main() {
    // Create a logger with common attributes
    serviceLogger := logger.With(
        "service", "user-service",
        "version", "1.0.0")
    
    // All logs from this logger will include the attributes
    serviceLogger.Info("Processing request", "request_id", "abc123")
    serviceLogger.Error("Request failed", "error", err)
}
```

### Setting as Default Logger

```go
package main

import (
    "log/slog"
    "github.com/jfxdev/gardarr/pkg/logger"
)

func main() {
    // Set as the default slog logger
    logger.SetDefault()
    
    // Now you can use the standard slog functions
    slog.Info("Using default logger")
    slog.Error("Error with default logger", "error", err)
}
```

### Using Custom Logger Instance

```go
package main

import "github.com/jfxdev/gardarr/pkg/logger"

func main() {
    // Create a new logger instance
    customLogger := logger.New()
    
    customLogger.Info("Custom logger instance")
}
```

## Output Format

Logs are output in JSON format:

```json
{"time":"2025-11-23T08:31:27.886556-03:00","level":"INFO","msg":"Application started","service":"api","version":"1.0.0"}
{"time":"2025-11-23T08:31:27.886723-03:00","level":"ERROR","msg":"Database error","error":"connection timeout","host":"localhost"}
```

### GORM SQL Query Logs (TRACE level)

When `LOG_LEVEL=TRACE`, SQL queries are logged with detailed information:

```json
{"time":"2025-11-23T08:34:04.354311-03:00","level":"TRACE","msg":"SQL query executed","component":"gorm","elapsed":100004461,"rows":1,"sql":"SELECT * FROM users WHERE id = 1"}
{"time":"2025-11-23T08:34:04.354489-03:00","level":"WARN","msg":"Slow SQL query detected","component":"gorm","elapsed":2000002138,"threshold":1000000000,"rows":1,"sql":"SELECT * FROM users WHERE id = 1"}
```

## Log Levels

| Level | Description | When to Use |
|-------|-------------|-------------|
| TRACE | Most verbose logging including SQL queries | Deep debugging and SQL optimization |
| DEBUG | Detailed diagnostic information | Development and troubleshooting |
| INFO | General informational messages | Normal application flow (default) |
| WARN | Warning messages for potentially harmful situations | Non-critical issues |
| ERROR | Error messages for failures | Application errors |

### TRACE Level Details

The TRACE level is the most verbose logging level and includes:
- All DEBUG, INFO, WARN, and ERROR logs
- **SQL queries executed by GORM** with execution time and affected rows
- Detailed database operation traces
- Performance metrics for database operations

**Important:** Only use TRACE in development or when debugging specific issues, as it can generate a large volume of logs.

## Testing

Run the test suite:

```bash
go test ./pkg/logger/... -v
```

## Integration Example

Example of integrating the logger in your application:

```go
package main

import (
    "github.com/jfxdev/gardarr/pkg/logger"
    "github.com/jfxdev/gardarr/cmd"
    "github.com/joho/godotenv"
    "os"
)

func main() {
    // Load environment variables
    _ = godotenv.Load()
    
    // Initialize logger (automatically done via init())
    logger.Info("Starting application", 
        "version", "1.0.0",
        "environment", os.Getenv("ENV"))
    
    // Set as default for the entire application
    logger.SetDefault()
    
    // Execute your application
    if err := cmd.Command().Execute(); err != nil {
        logger.Error("Application failed", "error", err)
        os.Exit(1)
    }
    
    logger.Info("Application stopped gracefully")
}
```

