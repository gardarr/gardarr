#!/bin/bash

# Script to check GitHub Container Registry package status
# Usage: ./scripts/check-package-status.sh

set -e

# Configuration
REPO_OWNER="gardarr"
PACKAGE_NAME="gardarr"
REGISTRY="ghcr.io"

echo "🔍 Checking package status..."
echo "📦 Package: $REGISTRY/$REPO_OWNER/$PACKAGE_NAME"

# Check if package exists by trying to pull it
echo "🐳 Testing package access..."

if docker pull $REGISTRY/$REPO_OWNER/$PACKAGE_NAME:latest 2>/dev/null; then
  echo "✅ Package is accessible and public!"
  echo "📋 Available tags:"
  docker images $REGISTRY/$REPO_OWNER/$PACKAGE_NAME --format "table {{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
else
  echo "❌ Package is not accessible"
  echo ""
  echo "💡 Possible reasons:"
  echo "   1. Package doesn't exist yet (workflow not run)"
  echo "   2. Package is private"
  echo "   3. Package name is incorrect"
  echo ""
  echo "🔧 Solutions:"
  echo "   1. Create a GitHub release to trigger the workflow"
  echo "   2. Check package visibility in GitHub Packages"
  echo "   3. Verify the package name in the workflow"
  echo ""
  echo "📝 To create a release:"
  echo "   git tag v1.0.0"
  echo "   git push origin v1.0.0"
  echo "   # Then go to GitHub → Releases → Create a new release"
fi
