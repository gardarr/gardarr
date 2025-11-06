# Define build arguments for image tags and port
ARG APP_PORT=3000

# Version build arguments
ARG VERSION=0.0.0
ARG COMMIT=unknown
ARG DATE=unknown

# Stage 1: Copy pre-compiled Go binary
FROM alpine:3.20 AS build

# BuildKit automatically provides these variables for multi-platform builds
ARG TARGETPLATFORM
ARG TARGETARCH
ARG TARGETOS

# Install necessary dependencies
RUN apk add --no-cache ca-certificates && \
    rm -rf /var/cache/apk/*

# Set the working directory inside the container
WORKDIR /app

# Copy all pre-compiled Go binaries
COPY backend/dist/ ./binaries/

# Select the correct binary based on target architecture
# TARGETARCH is automatically set by BuildKit (amd64, arm64, etc.)
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

# Stage 2: Create a minimal runtime image with curl for healthchecks
FROM alpine:3.20

# Install curl and ca-certificates for healthchecks and HTTPS
# Note: The binary is statically linked, so no runtime libraries are needed
RUN apk add --no-cache curl ca-certificates && \
    rm -rf /var/cache/apk/*

# Create a non-root user
RUN addgroup -g 65532 -S nonroot && \
    adduser -u 65532 -S nonroot -G nonroot

# Create /data directory for SQLite database and task images
# This directory will be used to store persistent data
RUN mkdir -p /data && \
    chown -R nonroot:nonroot /data && \
    chmod 755 /data

RUN mkdir -p /media && \
    chown -R nonroot:nonroot /media && \
    chmod 755 /media

# Set build argument for port
ARG APP_PORT=3000

# Set the working directory
WORKDIR /app

# Copy entrypoint script (before changing user)
COPY docker-entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh && \
    chown nonroot:nonroot /app/entrypoint.sh

# Copy the built binary from the builder stage
COPY --from=build /app/main .
RUN chmod +x ./main && \
    chown nonroot:nonroot ./main

# Copy the built frontend files
COPY --from=build /app/web ./web

# Set a default environment variable for the port
ENV PORT=${APP_PORT}

# Create volumes for persistent data
VOLUME ["/data", "/media"]

# Expose the application port (default service port)
# Agent port (3100) should be exposed separately when running in agent mode
EXPOSE ${APP_PORT}

# Run the Go application as non-root user
USER nonroot:nonroot

# Use entrypoint script to allow agent mode
ENTRYPOINT ["/app/entrypoint.sh"]

# Default command runs the service (no arguments = service mode)
CMD []
