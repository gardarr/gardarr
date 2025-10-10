# gardarr
Lightweight qBittorrent management and analytics tool, optimized for mobile

## 🚀 Quick Start with Docker

### Using Pre-built Images

The easiest way to run Gardarr is using the pre-built Docker images from GitHub Container Registry:

```bash
# Pull the latest image
docker pull ghcr.io/your-username/gardarr:latest

# Run with docker-compose
docker-compose up -d
```

### Building from Source

```bash
# Clone the repository
git clone https://github.com/your-username/gardarr.git
cd gardarr

# Build and run with Docker Compose
docker-compose up --build
```

## 🔄 Automated Builds

This project uses GitHub Actions to automatically build and publish Docker images to GitHub Container Registry (GHCR) when you publish a GitHub release or push version tags.

- **Multi-platform support**: Images are built for AMD64, ARM64, and ARMv7 architectures
- **Comprehensive security scanning**: Multi-layer vulnerability scanning with Trivy
- **Release-based publishing**: Images are only published for official releases

See [.github/workflows/README.md](.github/workflows/README.md) for detailed information about the CI/CD pipeline.

## 📋 Available Tags

- `latest` - Latest stable release
- `v1.0.0` - Specific version releases
- `1.0` - Major.minor version
- `1` - Major version only

## 🛠️ Development

See [DEVELOPMENT.md](DEVELOPMENT.md) for detailed development setup instructions.
