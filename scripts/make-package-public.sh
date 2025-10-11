#!/bin/bash

# Script to make GitHub Container Registry package public
# Usage: ./scripts/make-package-public.sh

set -e

# Configuration
REPO_OWNER="gardarr"
PACKAGE_NAME="gardarr"

echo "🔍 Checking package visibility..."

# Check if package exists and get its visibility
PACKAGE_INFO=$(gh api \
  --method GET \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  /orgs/$REPO_OWNER/packages/container/$PACKAGE_NAME 2>/dev/null || echo "Package not found")

if [[ "$PACKAGE_INFO" == "Package not found" ]]; then
  echo "❌ Package $PACKAGE_NAME not found in organization $REPO_OWNER"
  echo "💡 Make sure the package exists and you have access to it"
  exit 1
fi

# Extract visibility from the response
VISIBILITY=$(echo "$PACKAGE_INFO" | jq -r '.visibility // "unknown"')

echo "📦 Package: $REPO_OWNER/$PACKAGE_NAME"
echo "👁️  Current visibility: $VISIBILITY"

if [[ "$VISIBILITY" == "public" ]]; then
  echo "✅ Package is already public!"
  exit 0
fi

echo "🔓 Making package public..."

# Make the package public
gh api \
  --method PATCH \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  /orgs/$REPO_OWNER/packages/container/$PACKAGE_NAME \
  -f visibility=public

echo "✅ Package is now public!"
echo "🐳 You can now pull the image with:"
echo "   docker pull ghcr.io/$REPO_OWNER/$PACKAGE_NAME:latest"
