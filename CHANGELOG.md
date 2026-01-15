# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.9.0-beta] - 2026-01-XX

### Added

#### Core Features
- **Multi-Agent Architecture**: Support for standalone (single server) and distributed (multi-server) modes
- **Complete Torrent Management**: Full CRUD operations for torrents with advanced controls
  - Start, stop, pause, force resume
  - Speed limits (download/upload) per torrent
  - Share limits (ratio and seeding time)
  - Force recheck and force reannounce
  - Super seeding mode
  - File listing and management
- **Agent Management**: Register and manage multiple qBittorrent instances
  - Health checks
  - Secure communication via bearer tokens
  - Agent statistics and metrics

#### Event System
- **Event Tracking**: Automatic tracking of torrent lifecycle events
  - `torrent.state_change` - State transitions
  - `torrent.added` - New torrents detected
  - `torrent.removed` - Torrents removed
  - `torrent.completed` - Downloads completed
- **Event History Page**: Dedicated page to view and filter events
- **Configurable Retention**: Set how long to keep event history (default: 30 days)

#### Webhooks & Integrations
- **Webhook System**: Send HTTP notifications to external services
  - Create, update, delete webhooks
  - Event filtering by type, status, category, and name terms
  - Configurable timeout and SSL verification
  - Webhook delivery history
  - **Test Webhook**: Send test events to verify connectivity
- **Integration Page**: Central hub for managing integrations
  - Webhook configuration
  - Placeholder for future integrations (Ntfy, Jellyfin, Kavita, RoMM)

#### User Interface
- **Dashboard**: Real-time overview with metrics and statistics
- **Torrents Page**: Multiple view modes (table, cards, compact, mobile)
- **Categories Page**: Organize torrents with categories and tags
- **Settings Page**: System-wide configuration
- **Profile Page**: User preferences and security settings
- **Dark/Light Theme**: Toggle between themes
- **Custom Color Palettes**: 3 customizable color palettes per user
- **Internationalization**: Support for English (en-US) and Portuguese (pt-BR)
- **Mobile-First Design**: Responsive UI for all devices

#### Customization
- **Custom Torrent Metadata**: Add descriptions and notes to torrents
- **Cover Art Upload**: Upload custom images (JPEG, PNG, GIF, WEBP up to 5MB)
- **Image Positioning**: Adjust vertical position of cover images
- **Image Opacity**: Control transparency (15-85%)

#### Statistics & Analytics
- **Real-time Metrics**: Download/upload speeds, active peers, storage usage
- **Ratio Grading**: School grade system (E to S++) for ratio tracking
- **Historical Data**: Statistics collection at configurable intervals
- **Per-Agent Statistics**: Individual metrics for each agent

### Security
- **Argon2id Password Hashing**: State-of-the-art password security
- **HTTP-only Secure Cookies**: Session management with XSS protection
- **CSRF Protection**: SameSite cookie attribute
- **Content Security Policy (CSP)**: Configurable CSP headers
- **HSTS**: Strict Transport Security in production mode
- **Rate Limiting**: Protection against brute-force attacks
- **Session Management**: View active sessions, logout from all devices
- **Invite-Only Registration**: New users can only join via invitation links

### Infrastructure
- **SQLite & PostgreSQL Support**: Choose your database
- **Docker Native**: Optimized Dockerfile with multi-stage builds
- **Multi-Platform**: Docker images for linux/amd64 and linux/arm64
- **CI/CD Pipeline**: GitHub Actions for automated builds and releases
- **Database Migrations**: Versioned migrations with rollback support
- **Docker Compose Examples**: Ready-to-use configurations for different setups

### Developer Experience
- **Makefile**: Comprehensive build and development commands
- **Hot Reload**: Frontend development with Vite
- **Proxy Configuration**: Vite proxy for seamless API integration
- **Type Safety**: TypeScript frontend with strict typing
- **Code Quality**: ESLint, Prettier, and SonarCloud integration

### Documentation
- **README**: Comprehensive project overview
- **Authentication Guide**: Complete auth system documentation
- **Events System Guide**: Event tracking documentation
- **Environment Variables**: Full configuration reference
- **Security Headers**: Security configuration guide

### Technical Stack
- **Backend**: Go 1.25+, Gin Web Framework, GORM
- **Frontend**: React 19, Vite, TailwindCSS 4, React Query
- **Database**: SQLite (default), PostgreSQL (optional)

---

## Roadmap

### Planned for v1.0.0
- [ ] Ntfy integration for push notifications
- [ ] Jellyfin library synchronization
- [ ] Kavita library synchronization
- [ ] RoMM library synchronization
- [ ] Two-factor authentication (TOTP)
- [ ] API documentation (OpenAPI/Swagger)
- [ ] Comprehensive E2E tests

### Future Releases
- [ ] OIDC/SSO authentication
- [ ] Smart speed limits (schedule-based)
- [ ] Cross-host transfer (SCP between agents)
- [ ] Discord/Telegram bot integration
- [ ] Mobile native apps

---

[Unreleased]: https://github.com/jfxdev/gardarr/compare/v0.9.0-beta...HEAD
[0.9.0-beta]: https://github.com/jfxdev/gardarr/releases/tag/v0.9.0-beta
