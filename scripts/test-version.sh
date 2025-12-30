#!/bin/bash

# Script para testar se as informações de versão foram injetadas corretamente
# no binário compilado

set -e

BINARY_PATH="../gardarr"
BACKEND_DIR="../backend"

echo "🧪 Testing Version Information Injection"
echo "========================================"

if [ ! -f "$BINARY_PATH" ]; then
    echo "❌ Binary not found at $BINARY_PATH"
    echo "Please run 'make build-with-version' or './scripts/build.sh' first"
    exit 1
fi

echo "✅ Binary found: $BINARY_PATH"
echo ""

# Test 1: Check if binary contains version strings
echo "🔍 Test 1: Checking if binary contains version strings..."

# Extract version info from binary using strings command
VERSION_IN_BINARY=$(strings "$BINARY_PATH" | grep -E "^[0-9]+\.[0-9]+\.[0-9]+" | head -1 || echo "")
COMMIT_IN_BINARY=$(strings "$BINARY_PATH" | grep -E "^[a-f0-9]{40}$" | head -1 || echo "")
DATE_IN_BINARY=$(strings "$BINARY_PATH" | grep -E "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$" | head -1 || echo "")

if [ -n "$VERSION_IN_BINARY" ]; then
    echo "✅ Version found in binary: $VERSION_IN_BINARY"
else
    echo "❌ Version not found in binary"
fi

if [ -n "$COMMIT_IN_BINARY" ]; then
    echo "✅ Commit found in binary: $COMMIT_IN_BINARY"
else
    echo "❌ Commit not found in binary"
fi

if [ -n "$DATE_IN_BINARY" ]; then
    echo "✅ Date found in binary: $DATE_IN_BINARY"
else
    echo "❌ Date not found in binary"
fi

echo ""

# Test 2: Check binary size and type
echo "🔍 Test 2: Binary information..."
file "$BINARY_PATH"
ls -lh "$BINARY_PATH"

echo ""

# Test 3: Try to run the binary briefly to see if it starts
echo "🔍 Test 3: Testing binary startup..."
echo "Starting binary for 3 seconds..."

# Start binary in background
timeout 3s "$BINARY_PATH" 2>/dev/null &
BINARY_PID=$!

# Wait a moment for startup
sleep 1

# Check if process is still running
if kill -0 $BINARY_PID 2>/dev/null; then
    echo "✅ Binary started successfully"
    
    # Try to test version endpoint if possible
    echo "🔍 Test 4: Testing version endpoint..."
    
    # Wait a bit more for server to be ready
    sleep 2
    
    # Try to curl the version endpoint
    if command -v curl >/dev/null 2>&1; then
        VERSION_RESPONSE=$(curl -s http://localhost:3200/v1/version 2>/dev/null || echo "")
        if [ -n "$VERSION_RESPONSE" ]; then
            echo "✅ Version endpoint responded:"
            echo "$VERSION_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$VERSION_RESPONSE"
        else
            echo "⚠️  Version endpoint not accessible (server might not be ready or requires auth)"
        fi
    else
        echo "⚠️  curl not available, skipping endpoint test"
    fi
    
    # Kill the binary
    kill $BINARY_PID 2>/dev/null || true
    wait $BINARY_PID 2>/dev/null || true
else
    echo "❌ Binary failed to start"
fi

echo ""
echo "🎉 Version injection test completed!"
echo ""
echo "📋 Summary:"
echo "- Binary created: ✅"
echo "- Version strings embedded: $([ -n "$VERSION_IN_BINARY" ] && echo "✅" || echo "❌")"
echo "- Commit hash embedded: $([ -n "$COMMIT_IN_BINARY" ] && echo "✅" || echo "❌")"
echo "- Build date embedded: $([ -n "$DATE_IN_BINARY" ] && echo "✅" || echo "❌")"
