# Gardarr

<p align="center">
  <img src="assets/logo.png" alt="Gardarr Logo" width="20%" />
</p>

![GitHub go.mod Go version](https://img.shields.io/github/go-mod/go-version/gardarr/gardarr?filename=backend%2Fgo.mod)
[![React](https://img.shields.io/badge/React-%2320232a.svg?logo=react&logoColor=%2361DAFB)](#)
[![shadcn/ui](https://img.shields.io/badge/shadcn%2Fui-000?logo=shadcnui&logoColor=fff)](#)
![GitHub License](https://img.shields.io/github/license/gardarr/gardarr)
![GitHub Release](https://img.shields.io/github/v/release/gardarr/gardarr)
![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/gardarr/gardarr/.github%2Fworkflows%2Fbuild.yml)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=gardarr_gardarr&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=gardarr_gardarr)
[![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=gardarr_gardarr&metric=vulnerabilities)](https://sonarcloud.io/summary/new_code?id=gardarr_gardarr)
[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=gardarr_gardarr&metric=bugs)](https://sonarcloud.io/summary/new_code?id=gardarr_gardarr)
[![Duplicated Lines (%)](https://sonarcloud.io/api/project_badges/measure?project=gardarr_gardarr&metric=duplicated_lines_density)](https://sonarcloud.io/summary/new_code?id=gardarr_gardarr)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=gardarr_gardarr&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=gardarr_gardarr)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=gardarr_gardarr&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=gardarr_gardarr)
[![Lines of Code](https://sonarcloud.io/api/project_badges/measure?project=gardarr_gardarr&metric=ncloc)](https://sonarcloud.io/summary/new_code?id=gardarr_gardarr)

Lightweight qBittorrent management and analytics tool, optimized for mobile

**Fully open-source** project licensed under GPL-3.0, designed to be self-hosted by the community with clean and maintainable code.

## 📑 Table of Contents

- [✨ Key Features](#-key-features)
- [📋 Requirements](#-requirements)
- [🚀 Getting Started](#-getting-started)
- [🔌 Agents](#-agents)

## ✨ Key Features

- 🔌 **Multi-Agent Management**: Manage multiple qBittorrent instances from a single interface
- ⚡ **Torrent Control**: Add, pause, resume, delete, and prioritize torrents with ease
- 📊 **Advanced Analytics**: Comprehensive statistics and metrics with visual charts and dashboards
- ⭐ **Ratio Tracking**: Intelligent ratio grading system (E to S++) to monitor seeding contribution
- 🏷️ **Category Management**: Organize torrents with custom categories and tags
- 👥 **User Management**: Multi-user support with role-based access control
- 📱 **Mobile-First Design**: Responsive interface optimized for mobile devices
- 🐳 **Self-Hosted**: Full control with easy Docker deployment
- 📡 **Real-Time Monitoring**: Live updates on torrent status, speeds, and progress

## 📋 Requirements

- **Docker** and **Docker Compose** (for containerized deployment)
- **qBittorrent** instance(s) with Web UI version **5.x or above**
- **Database**: SQLite (default) or PostgreSQL (optional)

## 🚀 Getting Started

### Running on Docker

The easiest way to run Gardarr is using pre-built Docker images from GitHub Container Registry. Choose a deployment configuration that fits your needs:

#### 🖥️ Standalone Mode

Perfect for simple deployments where you want everything in one container. The application runs with an embedded agent that connects to your qBittorrent instance.

```bash
# Copy the standalone example
cp examples/standalone/docker-compose.yml docker-compose.yml

# Set your qBittorrent credentials in .env file
echo "QBITTORRENT_BASEURL=http://your-qbittorrent:8080" >> .env
echo "QBITTORRENT_USERNAME=your_username" >> .env
echo "QBITTORRENT_PASSWORD=your_password" >> .env

# Start the service
docker-compose up -d
```

[View Full Configuration →](./examples/standalone/docker-compose.yml)

#### 🔌 Agent Mode (Default)

Ideal for managing multiple qBittorrent instances across different hosts. Deploy the main application and register agents through the web interface.

```bash
# Copy the default example
cp examples/default/docker-compose.yml docker-compose.yml

# Set your agent secret and qBittorrent credentials
echo "AGENT_SECRET=$(openssl rand -hex 32)" >> .env
echo "QBITTORRENT_BASEURL=http://your-qbittorrent:8080" >> .env
echo "QBITTORRENT_USERNAME=your_username" >> .env
echo "QBITTORRENT_PASSWORD=your_password" >> .env

# Start the services
docker-compose up -d
```

[View Full Configuration →](./examples/default/docker-compose.yml)

#### 🐘 PostgreSQL Configuration

For production deployments requiring PostgreSQL instead of SQLite:

```bash
# Copy the PostgreSQL example
cp examples/postgres/docker-compose.yml docker-compose.yml

# Configure your environment
echo "POSTGRES_DB=gardarr" >> .env
echo "POSTGRES_USER=gardarr" >> .env
echo "POSTGRES_PASSWORD=your_secure_password" >> .env

# Start the services
docker-compose up -d
```

[View Full Configuration →](./examples/postgres/docker-compose.yml)

### Building from Source

```bash
# Clone the repository
git clone https://github.com/gardarr/gardarr.git
cd gardarr

# Build and run with Docker Compose
docker-compose up --build
```

## 🔌 Agents

Gardarr supports two agent operation modes:

### 🖥️ Standalone

Runs service and embedded agent together in a single process. Automatically creates a pre-configured agent—ideal for simple deployments.

To use this mode, add the variable `APP_MODE=standalone` in your deployment

[Configuration Example - Standalone](./examples/standalone/docker-compose.yml)

### 🔌 Agent Mode (Default)

Manage multiple independent qBittorrent instances. Register, edit, and remove agents through the web interface—perfect for distributed setups.

[Configuration Example - App + 1 Agent](./examples/default/docker-compose.yml)

## 🔄 Automated Builds

This project uses GitHub Actions to automatically build and publish Docker images to GitHub Container Registry (GHCR) when you publish a GitHub release or push version tags.

- **Multi-platform support**: Images are built for AMD64 and ARM64 architectures
- **Release-based publishing**: Images are only published for official releases

See [.github/workflows/README.md](.github/workflows/README.md) for detailed information about the CI/CD pipeline.

## 📋 Roadmap

Planned features and improvements for future releases:

- [ ] **Integrations Page**: Create custom webhooks and event triggers when torrents change their status (completed, paused, failed, etc.)

- [ ] **Smart Speed Limit Windows**: Advanced scheduling system for agent speed limits with time-based rules and automatic adjustments

- [ ] **OIDC Authentication**: Support for OpenID Connect (OIDC) providers for enhanced security and single sign-on (SSO) capabilities

- [ ] **Torrent Image Gallery**: Upload and display custom images for torrents to enhance visual organization and identification

- [ ] **Contribution Card Generator**: Generate shareable contribution cards showcasing seeding statistics for social media sharing

- [ ] **Cross-Host File Transfer**: Seamlessly move torrent files between different agent hosts using SCP protocol, enabling load balancing and storage management across distributed setups

## 🛠️ Development

See [DEVELOPMENT.md](DEVELOPMENT.md) for detailed development setup instructions.
