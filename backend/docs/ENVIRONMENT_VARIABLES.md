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
- **Note**: When `APP_URL=http://localhost:3200`, the backend also allows `http://localhost:3500` for the Vite dev server.

### `BANDWIDTH_SCHEDULE_INTERVAL`
- **Description**: Frequency for evaluating worker bandwidth schedules.
- **Default**: `1m`
- **Example**: `BANDWIDTH_SCHEDULE_INTERVAL=30s`
- **Note**: schedules use Gardarr's configured timezone. Do not enable qBittorrent's alternative-rate scheduler for the same worker.

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
- **Description**: Key used to encrypt sensitive data (e.g., stored qBittorrent credentials)
- **Default**: None (required for production)
- **Example**: `ENCRYPTION_KEY=your-32-byte-encryption-key-here`
- **Security**: Use `ENCRYPTION_KEY_FILE` with Docker secrets in production

### `CUSTOM_CSP` (Optional)
- **Description**: Custom Content Security Policy override
- **Default**: Uses built-in secure CSP
- **Example**: `CUSTOM_CSP="default-src 'self'; script-src 'self' 'unsafe-inline'"`
- **Use Case**: Only use if you need to customize CSP for specific requirements

---

## Worker Connectivity

### `WORKER_TIMEOUT_SECONDS`
- **Description**: Timeout in seconds for validating and communicating with direct qBittorrent worker connections
- **Default**: `10` (applied when not set or empty)
- **Example**: `WORKER_TIMEOUT_SECONDS=15`

---

## qBittorrent

### `QBITTORRENT_URL`
- **Description**: Base URL of the qBittorrent Web UI
- **Example**: `QBITTORRENT_URL=http://localhost:8080`

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

### `QBITTORRENT_LOGIN_MAX_RETRIES`
- **Description**: Maximum number of consecutive authentication failures before the direct client gives up reconnecting. Distinct from `QBITTORRENT_MAX_RETRIES` which governs per-request retries.
- **Default**: `5`
- **Example**: `QBITTORRENT_LOGIN_MAX_RETRIES=5`

---

## Prometheus Metrics

### `METRICS_USERNAME`
- **Description**: Username for Basic Auth on `/metrics` endpoint
- **Default**: Not set (endpoint disabled if not set)
- **Example**: `METRICS_USERNAME=prometheus`
- **Note**: Both `METRICS_USERNAME` and `METRICS_PASSWORD` must be set to enable the endpoint

### `METRICS_PASSWORD`
- **Description**: Password for Basic Auth on `/metrics` endpoint
- **Default**: Not set (endpoint disabled if not set)
- **Example**: `METRICS_PASSWORD=your-secure-password`
- **Security**: Use `METRICS_PASSWORD_FILE` with Docker secrets in production

### `EVENT_POLL_INTERVAL`
- **Description**: Interval for the event poller to check workers for task state changes
- **Default**: `30s`
- **Example**: `EVENT_POLL_INTERVAL=1m`

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

# Prometheus Metrics (optional)
METRICS_USERNAME=prometheus
METRICS_PASSWORD=your-secure-password

EVENT_RETENTION_DAYS=30
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
