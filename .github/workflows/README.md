# GitHub Actions Workflows

This directory contains GitHub Actions workflows for the Gardarr project.

## Docker Build and Push Workflow

The `docker-build.yml` workflow automatically builds and publishes Docker images to GitHub Container Registry (GHCR) when:

- A GitHub release is published
- Tags starting with `v` are pushed (e.g., `v1.0.0`)

### Features

- **Multi-platform builds**: Supports `linux/amd64`, `linux/arm64`, and `linux/arm/v7` architectures
- **Smart tagging**: Automatically generates appropriate tags based on releases and version tags
- **Comprehensive security scanning**: 
  - Trivy vulnerability scanning for images and filesystem
  - License compliance checking
  - Secret detection
  - Configuration security analysis
- **Build caching**: Leverages GitHub Actions cache for faster builds
- **Artifact attestation**: Generates build provenance for supply chain security
- **Parallel security scanning**: Dedicated security job runs after build completion

### Image Tags

The workflow generates the following tags:

- `latest` - For releases on the default branch
- `v1.0.0` - For version tags and releases
- `1.0` - Major.minor version
- `1` - Major version only

### Usage

1. **Automatic**: The workflow runs automatically when you publish a GitHub release or push a version tag
2. **Manual**: You can also trigger it manually from the Actions tab
3. **Package visibility**: After first release, make the package public in GitHub Packages settings

### Creating a Release

To trigger the workflow and publish a Docker image:

1. Create a new tag: `git tag v1.0.0`
2. Push the tag: `git push origin v1.0.0`
3. Go to GitHub → Releases → Create a new release
4. Select the tag and publish the release

The workflow will automatically build and publish the Docker image.

### Accessing the Image

Once published, you can pull the image using:

```bash
# Pull the latest version
docker pull ghcr.io/your-username/gardarr:latest

# Pull a specific version
docker pull ghcr.io/your-username/gardarr:v1.0.0

# Use in docker-compose
services:
  gardarr:
    image: ghcr.io/your-username/gardarr:latest
    # ... rest of configuration
```

### Security

- **Multi-layer scanning**: Images and filesystem are scanned for vulnerabilities using Trivy
- **Comprehensive analysis**: Includes vulnerability, secret, license, and configuration scanning
- **Build provenance**: Attested for supply chain security
- **Results integration**: All scan results are available in the GitHub Security tab
- **Severity filtering**: Configurable severity levels (CRITICAL, HIGH, MEDIUM, LOW)
- **Parallel execution**: Security scanning runs in a separate job for better performance

### Requirements

- `GITHUB_TOKEN` is automatically provided by GitHub Actions
- No additional secrets are required for basic functionality
- Package visibility can be managed in GitHub repository settings
