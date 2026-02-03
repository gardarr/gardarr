# Environment Variables

This document lists all environment variables used by Gardarr backend.

> **Docker Secrets Support**: All variables support Docker secrets using the `_FILE` suffix (e.g., `DATABASE_PASSWORD_FILE=/run/secrets/db_password`).

---

## Application

### `APP_PORT`
- **Description**: Port number where the server will listen
- **Default**: `3200`
- **Example**: `APP_PORT=8080`

### `APP_URL`
- **Description**: Public URL of the application. Used for CORS and secure cookies.
- **Default**: `http://localhost:3200`
- **Format**: Origin-only (`scheme://host[:port]`) — no path, query string, or trailing slash
- **Valid examples**:
  - `APP_URL=http://localhost:3200`
  - `APP_URL=https://gardarr.example.com`
  - `APP_URL=http://192.168.1.100:8080`
- **Invalid examples**:
  - `APP_URL=https://gardarr.example.com/` (trailing slash)
  - `APP_URL=https://gardarr.example.com/app` (path included)
- **Note**: When `APP_URL=http://localhost:3200`, the backend also allows `http://localhost:5173` for the Vite dev server.

### `APP_MODE`
- **Description**: Application mode for agent management
- **Values**: `standalone` or not set (normal mode)
- **Default**: Not set (normal mode)
- **Example**: `APP_MODE=standalone`
- **Note**: When set to `standalone`:
  - Adds a mock agent with URL `http://127.0.0.1:3100`
  - Automatically starts the agent service
  - Both service and agent run together in the same process

### `GIN_MODE`
- **Description**: Gin framework mode
- **Values**: `debug` (development) or `release` (production)
- **Default**: `release`
- **Example**: `GIN_MODE=debug`
- **Note**: In release mode, HSTS header is automatically enabled

### `LOG_LEVEL`
- **Description**: Application log level
- **Values**: `DEBUG`, `INFO`, `WARN`, `ERROR`
- **Default**: `INFO`
- **Example**: `LOG_LEVEL=DEBUG`

---

## Database

### `DATABASE_DRIVER`
- **Description**: Database driver to use
- **Values**: `sqlite` or `postgres`
- **Default**: `sqlite`
- **Example**: `DATABASE_DRIVER=postgres`

### `DATABASE_FILE_PATH`
- **Description**: Path to SQLite database file (only used when `DATABASE_DRIVER=sqlite`)
- **Default**: `/data/gardarr_database.db`
- **Example**: `DATABASE_FILE_PATH=./data/gardarr.db`

### `DATABASE_HOST`
- **Description**: PostgreSQL server hostname
- **Default**: `localhost`
- **Example**: `DATABASE_HOST=db.example.com`

### `DATABASE_PORT`
- **Description**: PostgreSQL server port
- **Default**: `5432`
- **Example**: `DATABASE_PORT=5432`

### `DATABASE_USERNAME`
- **Description**: PostgreSQL username
- **Default**: `gardarr`
- **Example**: `DATABASE_USERNAME=myuser`

### `DATABASE_PASSWORD`
- **Description**: PostgreSQL password
- **Default**: Empty
- **Example**: `DATABASE_PASSWORD=securepassword`
- **Security**: Use `DATABASE_PASSWORD_FILE` with Docker secrets in production

### `DATABASE_NAME`
- **Description**: PostgreSQL database name
- **Default**: `gardarr_database`
- **Example**: `DATABASE_NAME=gardarr`

### `DATABASE_SSL_MODE`
- **Description**: PostgreSQL SSL mode
- **Values**: `disable`, `require`, `verify-ca`, `verify-full`
- **Default**: `disable`
- **Example**: `DATABASE_SSL_MODE=require`

### `DATABASE_MAX_IDLE_CONNS`
- **Description**: Maximum number of idle connections in the pool
- **Default**: `10`
- **Example**: `DATABASE_MAX_IDLE_CONNS=20`

### `DATABASE_MAX_OPEN_CONNS`
- **Description**: Maximum number of open connections to the database
- **Default**: `100`
- **Example**: `DATABASE_MAX_OPEN_CONNS=50`

### `DATABASE_CONN_MAX_LIFETIME`
- **Description**: Maximum amount of time a connection may be reused
- **Default**: `1h`
- **Example**: `DATABASE_CONN_MAX_LIFETIME=30m`

---

## Security

### `ENCRYPTION_KEY`
- **Description**: Key used to encrypt sensitive data (e.g., agent tokens)
- **Default**: None (required for production)
- **Example**: `ENCRYPTION_KEY=your-32-byte-encryption-key-here`
- **Security**: Use `ENCRYPTION_KEY_FILE` with Docker secrets in production

### `CUSTOM_CSP` (Optional)
- **Description**: Custom Content Security Policy override
- **Default**: Uses built-in secure CSP
- **Example**: `CUSTOM_CSP="default-src 'self'; script-src 'self' 'unsafe-inline'"`
- **Use Case**: Only use if you need to customize CSP for specific requirements

---

## Agent

### `AGENT_PORT`
- **Description**: Port for the embedded agent service (standalone mode)
- **Default**: `3100`
- **Example**: `AGENT_PORT=3100`

### `AGENT_SECRET`
- **Description**: Secret key for agent authentication
- **Default**: Auto-generated in standalone mode
- **Example**: `AGENT_SECRET=your-secret-key`
- **Security**: Use `AGENT_SECRET_FILE` with Docker secrets in production

### `AGENT_TIMEOUT_SECONDS`
- **Description**: Timeout in seconds for agent communication
- **Default**: `3`
- **Example**: `AGENT_TIMEOUT_SECONDS=10`

---

## qBittorrent (Standalone Mode)

### `QBITTORRENT_BASEURL`
- **Description**: Base URL of the qBittorrent Web UI
- **Default**: None (required in standalone mode)
- **Example**: `QBITTORRENT_BASEURL=http://localhost:8080`

### `QBITTORRENT_USERNAME`
- **Description**: qBittorrent Web UI username
- **Default**: None
- **Example**: `QBITTORRENT_USERNAME=admin`

### `QBITTORRENT_PASSWORD`
- **Description**: qBittorrent Web UI password
- **Default**: None
- **Example**: `QBITTORRENT_PASSWORD=adminadmin`
- **Security**: Use `QBITTORRENT_PASSWORD_FILE` with Docker secrets in production

### `QBITTORRENT_REQUEST_TIMEOUT_SECONDS`
- **Description**: Timeout in seconds for qBittorrent API requests
- **Default**: `3`
- **Example**: `QBITTORRENT_REQUEST_TIMEOUT_SECONDS=10`

### `QBITTORRENT_MAX_RETRIES`
- **Description**: Maximum number of retries on failed requests
- **Default**: `0`
- **Example**: `QBITTORRENT_MAX_RETRIES=3`

### `QBITTORRENT_RETRY_BACKOFF`
- **Description**: Backoff time in seconds between retries
- **Default**: `1`
- **Example**: `QBITTORRENT_RETRY_BACKOFF=2`

---

## Statistics

### `STATISTICS_ENABLED`
- **Description**: Enable or disable statistics collection
- **Default**: `true`
- **Example**: `STATISTICS_ENABLED=false`

### `STATISTICS_DIR`
- **Description**: Directory for storing statistics data
- **Default**: `/data/statistics`
- **Example**: `STATISTICS_DIR=./data/statistics`

### `STATISTICS_INTERVAL`
- **Description**: Interval for collecting statistics
- **Default**: `30s`
- **Example**: `STATISTICS_INTERVAL=1m`

### `STATISTICS_RETENTION_DAYS`
- **Description**: Number of days to retain statistics data (0 = forever)
- **Default**: `0`
- **Example**: `STATISTICS_RETENTION_DAYS=90`

### `STATISTICS_PURGE_INTERVAL`
- **Description**: Interval for checking and purging old statistics
- **Default**: `30m`
- **Example**: `STATISTICS_PURGE_INTERVAL=1h`

---

## Events

### `EVENT_RETENTION_DAYS`
- **Description**: Number of days to retain event history
- **Default**: `7`
- **Example**: `EVENT_RETENTION_DAYS=30`

---

## Development

### `OVERRIDE_VERSION`
- **Description**: Override the reported application version (development only)
- **Default**: None
- **Example**: `OVERRIDE_VERSION=1.0.0-dev`

---

## Example Configuration Files

### Development (`.env.development`)
```bash
APP_PORT=3200
APP_URL=http://localhost:3200
GIN_MODE=debug
LOG_LEVEL=DEBUG

# Database (SQLite)
DATABASE_DRIVER=sqlite
DATABASE_FILE_PATH=./gardarr.db

# Standalone mode
# APP_MODE=standalone
# QBITTORRENT_BASEURL=http://localhost:8080
# QBITTORRENT_USERNAME=admin
# QBITTORRENT_PASSWORD=adminadmin
```

### Production (`.env.production`)
```bash
APP_PORT=3200
APP_URL=https://gardarr.example.com
GIN_MODE=release
LOG_LEVEL=INFO

# Database (PostgreSQL)
DATABASE_DRIVER=postgres
DATABASE_HOST=db
DATABASE_PORT=5432
DATABASE_USERNAME=gardarr
DATABASE_PASSWORD=securepassword
DATABASE_NAME=gardarr
DATABASE_SSL_MODE=require

# Security
ENCRYPTION_KEY=your-32-byte-encryption-key-here

# Statistics
STATISTICS_RETENTION_DAYS=90
EVENT_RETENTION_DAYS=30
```

### Standalone Mode
```bash
APP_MODE=standalone
APP_PORT=3200
AGENT_PORT=3100

QBITTORRENT_BASEURL=http://localhost:8080
QBITTORRENT_USERNAME=admin
QBITTORRENT_PASSWORD=adminadmin
```

---

## Security Considerations

1. **Never commit** `.env` files to version control
2. **Use Docker secrets** for sensitive values in production (`_FILE` suffix)
3. **Restrict CORS** in production to only your domain
4. **Enable HTTPS** in production before setting `GIN_MODE=release`
5. **Set `ENCRYPTION_KEY`** for encrypting sensitive data

---

## Related Documentation

- [SECURITY_HEADERS.md](./SECURITY_HEADERS.md) - Detailed security headers documentation
- [EVENTS_SYSTEM.md](./EVENTS_SYSTEM.md) - Events system documentation
