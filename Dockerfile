# Define build arguments for image tags and port
ARG APP_PORT=3200

# Version build arguments
ARG VERSION=0.0.0
ARG COMMIT=unknown
ARG DATE=unknown

# Stage 1: Prepare pre-compiled Go binary
FROM debian:bookworm-slim AS build

# BuildKit automatically provides these variables for multi-platform builds
ARG TARGETARCH

# Set the working directory inside the container
WORKDIR /app

# Copy all pre-compiled Go binaries
COPY backend/dist/ ./binaries/

# Select the correct binary based on target architecture
RUN if [ "$TARGETARCH" = "amd64" ]; then \
    cp binaries/gardarr-amd64 ./main; \
    elif [ "$TARGETARCH" = "arm64" ]; then \
    cp binaries/gardarr-arm64 ./main; \
    else \
    echo "Unsupported architecture: $TARGETARCH" && exit 1; \
    fi && \
    chmod +x ./main && \
    rm -rf ./binaries

# Copy pre-built frontend from GitHub Actions
COPY frontend/dist ./web

# Stage 2: Minimal runtime image with curl for healthcheck
FROM debian:bookworm-slim

# Install ca-certificates and curl for healthcheck
# Clean up apt cache to reduce image size
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ca-certificates \
        curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create data and media directories
# For proper permissions with custom users, use bind mounts in docker-compose
# Example: ./data:/data and ./media:/media (directories owned by your host user)
RUN mkdir -p /data /media

# Set build argument for port
ARG APP_PORT=3200

# Set the working directory
WORKDIR /app

# Copy the built binary from the builder stage
COPY --from=build /app/main /app/main

# Copy the built frontend files
COPY --from=build /app/web ./web

# Set a default environment variable for the port
ENV PORT=${APP_PORT}

# Create volumes for persistent data
VOLUME ["/data", "/media"]

# Expose the application port (default service port)
# Agent port (3100) should be exposed separately when running in agent mode
EXPOSE ${APP_PORT}

# User can be specified at runtime via docker-compose 'user:' directive
# Example: user: "${UID:-1000}:${GID:-1000}"
# If not specified, container runs as root (UID 0)

# Healthcheck should be defined in docker-compose based on the running mode:
# - Standalone: curl -f http://localhost:3200/v1/health
# - Agent: curl -f http://localhost:3100/health

# Default command runs the service
CMD ["/app/main"]
