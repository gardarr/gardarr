# Build Guide

This document describes how to compile Gardarr with dynamic version information.

## 🚀 Build with Dynamic Version

### Using Makefile

```bash
# Full build with dynamic version (recommended)
make build-full

# Backend only with dynamic version
make build-with-version

# Using the build script
make build-script
```

### Using Build Script

```bash
# Standard build (auto-detects version)
./scripts/build.sh

# Build with specific version
./scripts/build.sh "1.2.3"

# Build for specific platform
./scripts/build.sh "1.2.3" "dist" "linux" "arm64"
```

### Manual Build

```bash
# Get version information
make get-version

# Build with ldflags
cd backend
go build \
  -ldflags "-X github.com/jfxdev/gardarr/pkg/version.Version=1.2.3 \
            -X github.com/jfxdev/gardarr/pkg/version.Commit=abc1234 \
            -X github.com/jfxdev/gardarr/pkg/version.Date=2025-01-18T21:30:00Z \
            -w -s" \
  -o ../gardarr .
```

## 🐳 Build with Docker

### Local Build

```bash
# Build with default version
docker build -t gardarr .

# Build with specific version
docker build \
  --build-arg VERSION=1.2.3 \
  --build-arg COMMIT=abc1234 \
  --build-arg DATE=2025-01-18T21:30:00Z \
  -t gardarr .
```

### CI/CD Build

GitHub Actions automatically:
- Detects the version from the git tag (for releases)
- Uses commit count + hash for development builds
- Injects version information via ldflags
- Creates binaries for multiple platforms
- Generates Docker images with metadata

## 📋 Version Information

### Version Structure

- **Release**: `1.2.3` (based on git tag)
- **Development**: `0.0.0-dev+123.abc1234` (commit count + short hash)

### Injected Variables

- `Version`: Application version
- `Commit`: Full commit hash
- `Date`: Build date/time (UTC)

### Accessing Information

```bash
# Via API (requires authentication)
curl http://localhost:3200/v1/version

# Response:
{
  "version": "1.2.3",
  "commit": "abc1234567890abcdef1234567890abcdef1234",
  "date": "2025-01-18T21:30:00Z"
}
```

## 🔧 Configuration

### Environment Variables

```bash
# For manual override
export VERSION=1.2.3
export COMMIT=abc1234
export DATE=2025-01-18T21:30:00Z
```

### .version File

The Makefile generates a `.version` file with the information:

```bash
VERSION=1.2.3
COMMIT=abc1234567890abcdef1234567890abcdef1234
DATE=2025-01-18T21:30:00Z
```

## 🎯 Supported Platforms

### Binaries

- Linux (amd64, arm64)
- Windows (amd64)
- macOS (amd64, arm64)

### Docker

- linux/amd64
- linux/arm64

## 🚨 Troubleshooting

### Error: "package github.com/jfxdev/gardarr/pkg/version not found"

Check if the Go module is configured correctly:

```bash
cd backend
go mod tidy
go mod verify
```

### Error: "ldflags: invalid syntax"

Check if the quotes are correct in the ldflags command:

```bash
# ✅ Correct
-ldflags "-X pkg.version.Version=1.2.3"

# ❌ Incorrect
-ldflags '-X pkg.version.Version=1.2.3'
```

### Version does not appear in API

1. Check if the build was done with ldflags
2. Confirm if the `/v1/version` endpoint is registered
3. Test with `curl http://localhost:3200/v1/version`

## 📚 References

- [Go Build Constraints](https://pkg.go.dev/cmd/go#hdr-Build_constraints)
- [Go ldflags](https://pkg.go.dev/cmd/link)
- [GitHub Actions](https://docs.github.com/en/actions)
- [Docker Multi-stage Builds](https://docs.docker.com/build/building/multi-stage/)
