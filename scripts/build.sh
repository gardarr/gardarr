#!/bin/bash

# Build script for Gardarr backend with dynamic version injection
# Usage: ./scripts/build.sh [version] [output_dir]

set -e

# Default values
DEFAULT_VERSION="0.0.0-dev"
DEFAULT_OUTPUT="dist"
DEFAULT_OS="linux"
DEFAULT_ARCH="amd64"

# Parse arguments
VERSION=${1:-$DEFAULT_VERSION}
OUTPUT_DIR=${2:-$DEFAULT_OUTPUT}
TARGET_OS=${3:-$DEFAULT_OS}
TARGET_ARCH=${4:-$DEFAULT_ARCH}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Building Gardarr Backend${NC}"
echo -e "${BLUE}==========================${NC}"

# Get version information
if [ "$VERSION" = "$DEFAULT_VERSION" ]; then
    # Try to get version from git
    if command -v git &> /dev/null && [ -d ".git" ]; then
        # Check if we're on a tag
        if git describe --tags --exact-match HEAD &> /dev/null; then
            VERSION=$(git describe --tags --exact-match HEAD)
            VERSION=${VERSION#v}  # Remove 'v' prefix if present
        else
            # Use commit count and short hash for dev builds
            COMMIT_COUNT=$(git rev-list --count HEAD 2>/dev/null || echo "0")
            SHORT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
            VERSION="0.0.0-dev+${COMMIT_COUNT}.${SHORT_HASH}"
        fi
    fi
fi

# Get commit hash
if command -v git &> /dev/null && [ -d ".git" ]; then
    COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
else
    COMMIT="unknown"
fi

# Get build date
DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

echo -e "${YELLOW}Version Information:${NC}"
echo -e "  Version: ${GREEN}${VERSION}${NC}"
echo -e "  Commit:  ${GREEN}${COMMIT}${NC}"
echo -e "  Date:    ${GREEN}${DATE}${NC}"
echo -e "  Target:  ${GREEN}${TARGET_OS}/${TARGET_ARCH}${NC}"
echo ""

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Set build variables
export GOOS="$TARGET_OS"
export GOARCH="$TARGET_ARCH"
export CGO_ENABLED=0

# Determine binary name
BINARY_NAME="gardarr"
if [ "$TARGET_OS" = "windows" ]; then
    BINARY_NAME="${BINARY_NAME}.exe"
fi

OUTPUT_FILE="${OUTPUT_DIR}/${BINARY_NAME}"

echo -e "${BLUE}Building binary...${NC}"

# Build the application
cd backend

go build \
    -ldflags "-X github.com/gardarr/gardarr/pkg/version.Version=${VERSION} \
              -X github.com/gardarr/gardarr/pkg/version.Commit=${COMMIT} \
              -X github.com/gardarr/gardarr/pkg/version.Date=${DATE} \
              -w -s" \
    -o "../${OUTPUT_FILE}" \
    .

cd ..

# Check if build was successful
if [ -f "$OUTPUT_FILE" ]; then
    echo -e "${GREEN}✅ Build successful!${NC}"
    echo -e "${GREEN}Binary created: ${OUTPUT_FILE}${NC}"
    
    # Show binary info
    if [ "$TARGET_OS" != "windows" ]; then
        echo -e "${BLUE}Binary information:${NC}"
        file "$OUTPUT_FILE"
        ls -lh "$OUTPUT_FILE"
    fi
    
    # Test version endpoint if binary is for current platform
    if [ "$TARGET_OS" = "$(go env GOOS)" ] && [ "$TARGET_ARCH" = "$(go env GOARCH)" ]; then
        echo -e "${BLUE}Testing version information...${NC}"
        if timeout 5s "$OUTPUT_FILE" --version 2>/dev/null || echo "Binary doesn't support --version flag"; then
            echo -e "${GREEN}Version test completed${NC}"
        fi
    fi
else
    echo -e "${RED}❌ Build failed!${NC}"
    exit 1
fi

echo -e "${GREEN}🎉 Build completed successfully!${NC}"
