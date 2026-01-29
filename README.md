# Gardarr

<p align="center">
  <img src="assets/banner-lg.png" alt="Gardarr Logo" width="50%" />
</p>

<p align="center">
  <img src="https://img.shields.io/github/license/jfxdev/gardarr" alt="License" />
  <img src="https://img.shields.io/github/v/release/jfxdev/gardarr" alt="Release" />
  <img src="https://img.shields.io/github/actions/workflow/status/jfxdev/gardarr/.github%2Fworkflows%2Fbuild.yml" alt="GitHub Actions" />
  <img src="https://img.shields.io/coderabbit/prs/github/jfxdev/gardarr?utm_source=oss&utm_medium=github&utm_campaign=gardarr%2Fgardarr&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews" alt="CodeRabbit Reviews" />
  <br />
  <a href="https://sonarcloud.io/summary/new_code?id=jfxdev_gardarr"><img src="https://sonarcloud.io/api/project_badges/measure?project=jfxdev_gardarr&metric=alert_status" alt="Quality Gate Status" /></a>
  <a href="https://sonarcloud.io/summary/new_code?id=jfxdev_gardarr"><img src="https://sonarcloud.io/api/project_badges/measure?project=jfxdev_gardarr&metric=vulnerabilities" alt="Vulnerabilities" /></a>
  <a href="https://sonarcloud.io/summary/new_code?id=jfxdev_gardarr"><img src="https://sonarcloud.io/api/project_badges/measure?project=jfxdev_gardarr&metric=bugs" alt="Bugs" /></a>
  <a href="https://sonarcloud.io/summary/new_code?id=jfxdev_gardarr"><img src="https://sonarcloud.io/api/project_badges/measure?project=jfxdev_gardarr&metric=duplicated_lines_density" alt="Duplicated Lines" /></a>
  <a href="https://sonarcloud.io/summary/new_code?id=jfxdev_gardarr"><img src="https://sonarcloud.io/api/project_badges/measure?project=jfxdev_gardarr&metric=sqale_rating" alt="Maintainability Rating" /></a>
  <a href="https://sonarcloud.io/summary/new_code?id=jfxdev_gardarr"><img src="https://sonarcloud.io/api/project_badges/measure?project=jfxdev_gardarr&metric=security_rating" alt="Security Rating" /></a>
  <a href="https://sonarcloud.io/summary/new_code?id=jfxdev_gardarr"><img src="https://sonarcloud.io/api/project_badges/measure?project=jfxdev_gardarr&metric=ncloc" alt="Lines of Code" /></a>
</p>

Gardarr is a **modern, lightweight management and analytics platform for qBittorrent**, built with performance and user experience in mind. It provides a centralized interface to monitor and control multiple torrent clients, offering advanced insights and a mobile-first design.

**Fully open-source** project licensed under GPL-3.0, designed to be self-hosted by the community with clean and maintainable code.

## 📑 Table of Contents

- [✨ Key Features](#-key-features)
- [📋 Requirements](#-requirements)
- [🚀 Getting Started](#-getting-started)
  - [Standalone Mode](#-standalone-mode)
  - [Distributed Agent Mode](#-distributed-agent-mode)
- [🏗️ Architecture](#-architecture)
- [🏆 Ratio Grading System](#-ratio-grading-system)
- [🔌 Integrations & Events](#-integrations--events)
- [🎨 Customization](#-customization)
  - [Theme Customization](#theme-customization)
  - [Custom Cover Art & Metadata](#custom-cover-art--metadata)
  - [Categories](#categories)
  - [Tags & Composite Tags](#tags--composite-tags)
- [🛠️ Technology Stack](#-technology-stack)
- [⚙️ Configuration](#-configuration)
- [🛠️ Development](#-development)
- [📋 Roadmap](#-roadmap)

## ✨ Key Features

- **🔌 Multi-Agent Management**: Centralized dashboard to manage multiple qBittorrent instances across different servers.
- **⚡ Torrent Control**: Full control to add, pause, resume, delete, and prioritize torrents.
- **📊 Advanced Analytics**:
  - Real-time download/upload speed monitoring.
  - Historical data analysis.
  - **Ratio Grading**: Intelligent "School Grade" system (E to S++) for ratio tracking.
- **📝 Event System**: Comprehensive event tracking for state changes, completions, and errors, persisted in the database.
- **🔐 Secure Authentication**: 
  - Argon2id password hashing.
  - HTTP-only secure cookies for session management.
  - Role-based access control (RBAC).
- **🏷️ Organization**: Smart category management with advanced tagging system supporting composite tags.
- **📱 Mobile-First**: Responsive UI designed for seamless usage on smartphones and tablets.
- **🐳 Docker Native**: Built for containerized environments with support for Docker secrets.

## 📋 Requirements

- **Docker** and **Docker Compose**
- **qBittorrent** v4.1+ (Web UI enabled)
- **Resources**: <100MB RAM typical usage

## 🚀 Getting Started

### 🖥️ Standalone Mode
The easiest way to get started. Manages a single qBittorrent instance.

```bash
# Copy the standalone example
cp examples/standalone/docker-compose.yml docker-compose.yml

# Configure credentials
echo "QBITTORRENT_BASEURL=http://your-qbittorrent:8080" >> .env
echo "QBITTORRENT_USERNAME=your_username" >> .env
echo "QBITTORRENT_PASSWORD=your_password" >> .env

# Start Gardarr
docker-compose up -d
```
Access the dashboard at `http://localhost:3200`.

### 🔌 Distributed Agent Mode
For managing multiple instances.

1. **Generate an Agent Secret**:
   
   The `AGENT_SECRET` is used to secure communication between the main service and remote agents. Generate a secure random key using one of these methods:

   **Option 1: Using OpenSSL**
   ```bash
   openssl rand -hex 32
   ```

   **Option 2: Using Docker**
   ```bash
   docker run --rm ghcr.io/jfxdev/gardarr:latest generate key
   ```

   Copy the generated key and add it to your `.env` file:
   ```bash
   AGENT_SECRET=your_generated_secret_here
   ```

2. **Deploy the Main Service**:
   ```bash
   cp examples/default/docker-compose.yml docker-compose.yml
   docker-compose up -d
   ```

3. **Register Agents**:
   - Go to the UI → Settings → Agents.
   - Generate a new Agent Key.
   - Deploy a Gardarr Agent container on your remote server using the generated key.

## 🏗️ Architecture

Gardarr is designed with flexibility in mind, offering two primary operational modes:

### 1. Standalone Mode (Single Server)
Ideal for home users with a single media server. The application runs as a single process containing both the **Management Service** and an **Embedded Agent**.
- **Simplicity**: One container to deploy.
- **Efficiency**: Direct communication with local qBittorrent.

### 2. Distributed Mode (Multi-Server)
Designed for power users with multiple seedboxes or servers.
- **Central Service**: The main web application and database.
- **Remote Agents**: Lightweight binaries deployed alongside each qBittorrent instance that communicate securely with the Central Service.

## 🏆 Ratio Grading System

Gardarr features an intelligent **"School Grade"** system that gamifies torrent sharing, encouraging healthy seeding behavior and community contribution.

### Grade Levels

The system evaluates your share ratio and assigns a grade from **E** (beginner) to **S++** (legendary):

| Grade | Ratio Range | Description | Stars |
|-------|-------------|-------------|-------|
| **S++** | ≥ 100.0 | LEGENDARY - Community hero | ⭐⭐⭐⭐⭐ |
| **S+** | 50.0 - 99.9 | INCREDIBLE - Raising the bar | ⭐⭐⭐⭐⭐ |
| **S** | 30.0 - 49.9 | MASTER - Excellent contribution | ⭐⭐⭐⭐⭐ |
| **A** | 15.0 - 29.9 | ADVANCED - Very good participation | ⭐⭐⭐⭐ |
| **B** | 7.0 - 14.9 | INTERMEDIATE - Nice work | ⭐⭐⭐ |
| **C** | 3.0 - 6.9 | APPRENTICE - Almost there | ⭐⭐ |
| **D** | 1.0 - 2.9 | NOVICE - You're contributing | ⭐ |
| **E** | < 1.0 | BEGINNER - Keep seeding | - |

### Visual Feedback

Each grade comes with:
- **Color-coded badges**: Instantly recognize performance levels
- **Star ratings**: Visual representation from 1 to 5 stars
- **Motivational messages**: Encouraging feedback for each grade level
- **Glow effects**: Higher grades feature special visual effects

### Ratio Widget

The Torrent Details modal includes a comprehensive Ratio Widget displaying:
- **Current ratio** with decimal precision
- **Total uploaded data** in human-readable format
- **Popularity metric** showing relative torrent demand
- **Grade badge** with stars and description
- **Personalized message** encouraging continued sharing

### Benefits

- **Gamification**: Makes seeding fun and rewarding
- **Visual motivation**: Clear progress indicators encourage better ratios
- **Community health**: Promotes sustainable sharing practices
- **Achievement tracking**: Celebrate milestones as you climb the grades

## 🔌 Integrations & Events

The platform features a robust event-driven architecture to keep you connected:

### Event System
Automatically tracks and persists lifecycle events in the database:
- **State Changes**: Monitor transitions (e.g., Downloading → Seeding, Paused → Resumed).
- **Lifecycle**: Track when torrents are added, removed, or completed.
- **Retention**: Configurable history retention (Default: 30 days) via `EVENT_RETENTION_DAYS`.

#### Event History Page
A comprehensive interface to monitor all torrent activity:

**Event Types Tracked:**
- **State Changes** (`torrent.state_change`): Monitors status transitions with before/after states
- **Torrent Added** (`torrent.added`): Logs when new torrents are detected
- **Torrent Removed** (`torrent.removed`): Tracks when torrents are deleted
- **Torrent Completed** (`torrent.completed`): Celebrates when downloads reach 100%

**Features:**
- **Real-time Statistics**: Dashboard cards showing total events and current page counts
- **Advanced Filtering**: Filter by event type to focus on specific activities
- **Search Functionality**: Find events by torrent name or hash
- **Pagination**: Navigate through event history with intelligent page controls
- **Visual Indicators**: Color-coded badges and icons for each event type
- **Detailed Metadata**: View state transitions, progress changes, and timestamps
- **Relative Time Display**: Shows "2 hours ago" with full timestamp on hover

**Performance:**
- Integrated with statistics polling (configurable via `STATISTICS_INTERVAL`)
- Efficient in-memory state tracking with O(1) lookups
- Concurrent processing per agent for minimal overhead
- Database indexing on agent_id, type, task_hash, and created_at

### Webhooks
Connect Gardarr to external services like Discord, Slack, or automation tools (n8n, Home Assistant):
- **Flexible Targets**: Configure multiple webhook endpoints.
- **Event Filtering**: Select exactly which events trigger notifications for each webhook.
- **Security**: Support for SSL verification skipping (optional) and secure timeouts.
- **History**: Logs webhook delivery attempts for debugging.

## 🎨 Customization

Gardarr allows you to personalize your library with rich metadata and visual options.

### Theme Customization

Gardarr offers extensive theme personalization to match your preferences:

#### Dark & Light Modes
- **Toggle themes** instantly with a single click
- **Persistent preference** saved across sessions
- **System-wide consistency** throughout the interface

#### Color Variants
Choose from **14 pre-built color palettes** to customize the interface:

| Variant | Description |
|---------|-------------|
| **Default** | Classic blue theme |
| **Aura** | Purple mystique |
| **Sunset** | Warm orange tones |
| **Ocean** | Deep blue waters |
| **Forest** | Natural green |
| **Lavender** | Soft purple |
| **Rose** | Elegant pink |
| **Amber** | Golden warmth |
| **Mint** | Fresh cyan |
| **Crimson** | Bold red |
| **Cyberpunk** | Neon cyan & magenta |
| **Golden** | Luxurious gold |
| **Earth** | Neutral brown |
| **Silver** | Minimalist gray |

#### Custom Palettes
Create your own color schemes with **3 customizable palette slots**:
- **4-color system**: Primary, Secondary, Accent, and Muted
- **Live preview**: See changes in real-time
- **Profile integration**: Edit palettes in your profile preferences
- **Instant switching**: Toggle between custom and preset themes

### Custom Cover Art & Metadata

- **Custom Cover Art**: Upload custom images (JPEG, PNG, GIF, WEBP) for any torrent up to 10MB.
- **Visual Fine-Tuning**: 
  - **Positioning**: Adjust the vertical position of cover images.
  - **Opacity**: Control image transparency (15-85%) for better text readability.
- **Rich Metadata**: Add custom descriptions and notes to your torrents.

### Categories

Categories are the foundation of Gardarr's organization system, providing a structured way to manage and classify your torrents. By pre-configuring categories with default tags and directories, you can add new torrents quickly without the overhead of manual configuration - simply select a category and all its settings are automatically applied.

#### Core Features
- **Unique Names**: Each category has a unique, immutable name that serves as its identifier
- **Custom Icons**: Choose from 16 pre-defined icons (Folder, Film, TV, Music, Games, etc.)
- **Color Coding**: Select from 10 vibrant colors to visually distinguish categories
- **Default Directory**: Optionally specify a default save path for torrents in this category
- **Default Tags**: Pre-configure tags that are automatically applied to new torrents

#### Visual Customization
Categories support extensive visual customization:
- **16 Available Icons**: Folder, FolderOpen, Film, Tv, Music, BookOpen, Gamepad2, FileText, Image, Video, Download, Star, Heart, Archive, Package, Disc
- **10 Color Options**: Blue, Green, Purple, Red, Orange, Pink, Indigo, Teal, Yellow, Gray

#### Category Management
- **Create**: Define new categories with custom properties
- **Edit**: Update tags, directory, color, and icon (name is immutable)
- **Delete**: Remove categories when no longer needed
- **Search**: Quickly filter categories by name

#### Integration with Torrents
Categories streamline torrent management by eliminating repetitive configuration. When adding a new torrent, simply select a category and it automatically:
- **Applies all default tags** from that category
- **Sets the save directory** (if configured)
- **Provides visual context** through color and icon

This approach significantly reduces the overhead when adding multiple torrents, as you no longer need to manually configure tags and directories for each one. Configure once in the category, use everywhere.

### Tags & Composite Tags

Gardarr features a powerful tagging system to organize your torrents:

#### Simple Tags
Basic labels to categorize content (e.g., `movies`, `tv-shows`, `music`).

#### Composite Tags
Advanced tags using the `::` separator to create hierarchical relationships:
- **Format**: `category::value`
- **Examples**:
  - `genre::action` - Categorize by genre
  - `quality::4k` - Mark quality level
  - `status::watched` - Track viewing status
  - `year::2024` - Organize by year

**Visual Distinction**: Composite tags are rendered as connected badges with distinct colors - the category part uses the primary theme, while the value part uses the secondary theme, making them easy to identify at a glance.

#### Category Default Tags
When creating categories, you can define default tags that are automatically applied to new torrents:
- Tags can be simple or composite
- Multiple tags can be assigned per category
- Helps maintain consistent organization across your library

## 🛠️ Technology Stack

### Backend
- **Language**: Go 1.25+
- **Framework**: Gin Web Framework
- **Database**: SQLite (default) or PostgreSQL (via GORM)
- **Authentication**: Argon2id + Secure Sessions
- **Config**: Viper (Environment variables & file-based secrets)

### Frontend
- **Framework**: React 19 + Vite
- **Styling**: TailwindCSS 4
- **Charts**: Recharts
- **State/Data**: React Query / Context API
- **Icons**: Lucide React

## ⚙️ Configuration

Gardarr is configured via environment variables. Create a `.env` file in the root directory.

| Variable | Description | Default |
|----------|-------------|---------|
| `APP_PORT` | Port for the web interface | `3200` |
| `APP_URL` | Public URL of Gardarr (used for CORS and links) | `http://localhost:3200` |
| `GIN_MODE` | `debug` or `release` | `debug` |
| `APP_MODE` | Set to `standalone` to enable embedded agent | - |
| `DB_TYPE` | Database type (`sqlite` or `postgres`) | `sqlite` |
| `EVENT_RETENTION_DAYS` | Days to keep event history | `30` |
| `STATISTICS_INTERVAL` | Polling interval for stats | `30s` |

### Database Configuration (PostgreSQL)
```bash
DB_TYPE=postgres
POSTGRES_HOST=db
POSTGRES_USER=gardarr
POSTGRES_PASSWORD=securepassword
POSTGRES_DB=gardarr
POSTGRES_PORT=5432
```

For a complete list of environment variables, see [backend/docs/ENVIRONMENT_VARIABLES.md](backend/docs/ENVIRONMENT_VARIABLES.md).

## 🛠️ Development

We welcome contributions! Please see [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for detailed setup instructions.

```bash
# Quick dev start
git clone https://github.com/jfxdev/gardarr.git
cd gardarr
make dev
```

## 📋 Roadmap

- [ ] **Integrations Page**: Support for external integrations (Jellyfin, Ntfy, etc.).
- [ ] **Smart Speed Limits**: Schedule-based and adaptive speed limits.
- [ ] **OIDC Authentication**: SSO support.
- [ ] **Cross-Host Transfer**: SCP transfer between agents.

## 📄 License

This project is licensed under the GPL-3.0 License - see the [LICENSE](LICENSE) file for details.
