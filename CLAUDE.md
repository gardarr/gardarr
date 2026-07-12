# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Gardarr — self-hosted management/analytics platform for qBittorrent. Go backend (Gin + GORM, SQLite/Postgres), React 19 + Vite frontend. Single-process architecture: one Gardarr service connects directly to one or more registered qBittorrent Web UI endpoints (no separate worker process).

## Commands

```bash
make install          # install frontend + backend deps
make dev              # run frontend + backend in parallel (hot reload)
make run-backend      # backend only, cd backend && go run main.go -> :3200
make run-frontend     # frontend only, cd frontend && npm run dev -> :5173 (proxies /v1 and /media to :3200)

make test-backend     # cd backend && go test ./...
cd backend && go test ./internal/services/auth/...   # single package
cd backend && go test ./internal/services/auth/... -run TestName   # single test

cd frontend && npm test           # vitest
cd frontend && npx vitest run     # same, non-watch (also `npm run test:unit`)
cd frontend && npm run lint       # eslint
cd frontend && npm run build      # tsc -b && vite build

make build-full       # full production build (frontend build -> copied into backend/web -> go build)
```

No root-level lint/test command — backend and frontend are linted/tested independently.

## Architecture

### Backend (`backend/`)

- `main.go` -> `cmd/cmd.go` (cobra) -> `cmd/service/service.go`: this is where the app wires up. `Run()` validates filesystem paths, connects the DB, runs migrations, bootstraps settings/integrations, builds services, calls `setRoutes`, then starts the HTTP server with graceful shutdown.
- **Route modules** live in `internal/routes/api/v1/<feature>/`. Each exposes `NewModule(routerGroup, ...deps) *Module` and a `Register()` method that mounts its own `router.Group("/<feature>")`. Add a new API feature by creating a module package and registering it in `setRoutes` (service.go).
- **Layering**: routes -> `internal/services/<feature>` (business logic) -> `internal/repository/<feature>` (GORM data access) -> `internal/models` / `internal/entities`. `internal/mappers` convert between models and API schemas (`internal/schemas`).
- **Database**: `internal/infra/database` wraps GORM, supports `sqlite` (default) or `postgres` via `DATABASE_DRIVER`. Migrations are in `internal/infra/migration/migrations.go`, run automatically on startup via `database.RunMigrations(db)`.
- **Workers**: `internal/services/workermanager` manages direct connections to registered qBittorrent instances (credentials encrypted via `internal/services/crypto`).
- **Events**: `internal/services/events` persists torrent lifecycle events; `internal/services/eventpoller` polls workers and feeds the events service; `internal/services/integration` consumes the event channel in real time to drive webhooks/integrations.
- **Metrics**: `internal/routes/metrics` optionally registers a Prometheus `/metrics` endpoint (only if `METRICS_USERNAME`/`METRICS_PASSWORD` are set).
- **Media**: uploaded cover art served from `/media/*filepath` behind session auth (`middlewares.SessionMiddleware`), with path traversal protection in `buildSafeMediaPath` (service.go).
- SPA fallback: any non-`/v1/*` route serves `backend/web/index.html` (the built frontend, copied there by `make copy-frontend`).
- Security headers (CSP, HSTS, X-Frame-Options, Permissions-Policy, etc.) are set centrally in `securityHeadersMiddleware()` in `service.go`; `CUSTOM_CSP` env var overrides the default CSP.

### Frontend (`frontend/`)

- React 19 + Vite + TailwindCSS 4, React Router, React Query/Context for state, Recharts for charts, i18next for localization (`src/locales`), Radix UI primitives (`src/components/reui`, `src/components/ui`).
- API calls go through the client in `src/lib/api.ts`; dev server proxies `/v1` and `/media` to the backend at `:3200` (`vite.config.ts`).
- Tests use Vitest + jsdom, setup file `src/test-setup.ts`; co-located in `__tests__` directories.

### Configuration

Fully env-var driven (see `backend/docs/ENVIRONMENT_VARIABLES.md` for the full list); every variable supports Docker secrets via a `_FILE` suffix. Key ones: `APP_PORT`, `APP_URL`, `DATABASE_DRIVER`, `ENCRYPTION_KEY` (encrypts stored qBittorrent credentials), `WORKER_TIMEOUT_SECONDS`, `EVENT_RETENTION_DAYS`.

## Conventions

- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `chore`), scoped e.g. `fix(auth): ...`.
- Go: standard `gofmt`, run `go vet` before committing, table-driven tests where appropriate.
- Frontend: TypeScript strict mode, functional components with hooks.
