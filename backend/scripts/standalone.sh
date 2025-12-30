#!/bin/bash

# Standalone mode script for Gardarr
# This script demonstrates how to run Gardarr in standalone mode
# where both the service and agent run together

echo "🚀 Starting Gardarr in STANDALONE mode..."
echo "📋 This will start:"
echo "   - Service on port 3200 (default)"
echo "   - Agent on port 3100"
echo "   - Mock standalone agent will be available"
echo ""

# Set environment variables for standalone mode
export APP_MODE=standalone
export APP_PORT=3200
export AGENT_PORT=3100
export AGENT_SECRET=standalone-secret-key

# Optional: Set database to use SQLite for easier standalone setup
export DATABASE_DRIVER=sqlite
export DATABASE_FILE_PATH=./standalone.db

echo "🔧 Environment variables set:"
echo "   APP_MODE=$APP_MODE"
echo "   APP_PORT=$APP_PORT"
echo "   AGENT_PORT=$AGENT_PORT"
echo "   AGENT_SECRET=$AGENT_SECRET"
echo ""

# Build the application
echo "🔨 Building application..."
go build -o gardarr ./cmd/service

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build successful!"
echo ""

# Start the application
echo "🚀 Starting Gardarr service..."
echo "   Service will be available at: http://localhost:3200"
echo "   Agent will be available at: http://localhost:3100"
echo "   Mock standalone agent will be included in the agents list"
echo ""
echo "Press Ctrl+C to stop both services"
echo ""

./gardarr
