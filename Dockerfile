# Define build arguments for image tags and port
ARG APP_PORT=3200

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

# Stage 2: Prepare runtime dependencies
FROM alpine:3.20 AS runtime-prep

# Install ca-certificates and copy necessary files
RUN apk add --no-cache ca-certificates

# Create necessary directories and passwd/group files for scratch
RUN mkdir -p /tmp-root/etc /tmp-root/tmp /tmp-root/data /tmp-root/media && \
    echo "nobody:x:65534:65534:Nobody:/:/sbin/nologin" > /tmp-root/etc/passwd && \
    echo "nobody:x:65534:" > /tmp-root/etc/group && \
    chmod 1777 /tmp-root/tmp

# Stage 3: Create minimal scratch runtime image
FROM scratch

# Copy CA certificates from runtime-prep
COPY --from=runtime-prep /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

# Copy passwd and group files for user mapping
COPY --from=runtime-prep /tmp-root/etc/passwd /etc/passwd
COPY --from=runtime-prep /tmp-root/etc/group /etc/group

# Copy tmp directory
COPY --from=runtime-prep /tmp-root/tmp /tmp

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

# Run as nobody user by default (can be overridden with --user flag)
USER 65534:65534

# Default command runs the service
CMD ["/app/main"]
