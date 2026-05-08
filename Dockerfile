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

# Stage 2: Minimal runtime image with wget for healthcheck
FROM alpine:3.23.4

# Install ca-certificates and wget for healthcheck
RUN apk add --no-cache ca-certificates wget && \
    addgroup -g 1000 appgroup && \
    adduser -u 1000 -G appgroup -D appuser && \
    mkdir -p /data /media /app && \
    chown -R appuser:appgroup /data /media /app

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
EXPOSE ${APP_PORT}

# Default user is 'appuser' (UID 1000). Override via docker-compose 'user:' directive
# Example: user: "${UID:-1000}:${GID:-1000}"
USER appuser

# Healthcheck should be defined in docker-compose:
# wget -q --spider http://localhost:3200/v1/health

# Default command runs the service
CMD ["/app/main"]
