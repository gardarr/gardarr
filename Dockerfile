# Define build arguments for image tags and port
ARG GO_IMAGE=golang:1.25.3-alpine
ARG NODE_IMAGE=node:24.10.0-alpine
ARG APP_PORT=3000

# Version build arguments
ARG VERSION=0.0.0
ARG COMMIT=unknown
ARG DATE=unknown

# Stage 1: Build the frontend
FROM ${NODE_IMAGE} AS frontend-build

# Set the working directory for frontend
WORKDIR /app/frontend

# Copy frontend package files
COPY frontend/package*.json ./

# Install all frontend dependencies (including dev dependencies for build)
# Note: We need dev dependencies like TypeScript and Vite for the build process
RUN npm ci && \
    npm cache clean --force

# Copy frontend source code
COPY frontend/ .

# Build the frontend and clean up
RUN npm run build && \
    rm -rf node_modules && \
    rm -rf src && \
    rm -rf public && \
    rm -f package*.json && \
    rm -f tsconfig.json && \
    rm -f vite.config.ts && \
    rm -f tailwind.config.js && \
    rm -f postcss.config.js

# Stage 2: Copy pre-compiled Go binary
FROM alpine:3.20 AS build

# Install necessary dependencies
RUN apk add --no-cache ca-certificates && \
    rm -rf /var/cache/apk/*

# Set the working directory inside the container
WORKDIR /app

# Copy all pre-compiled Go binaries
COPY backend/dist/ ./binaries/

# Select the correct binary based on architecture
RUN ARCH=$(uname -m) && \
    if [ "$ARCH" = "x86_64" ]; then \
        cp binaries/gardarr-amd64 ./main; \
    elif [ "$ARCH" = "aarch64" ]; then \
        cp binaries/gardarr-arm64 ./main; \
    else \
        echo "Unsupported architecture: $ARCH" && exit 1; \
    fi && \
    chmod +x ./main && \
    rm -rf ./binaries

# Copy built frontend from frontend-build stage
COPY --from=frontend-build /app/frontend/dist ./web

# Stage 3: Create a minimal runtime image with curl for healthchecks
FROM alpine:3.20

# Install curl, ca-certificates, and SQLite runtime library
# SQLite runtime library is needed for the CGO-linked binary to work
RUN apk add --no-cache curl ca-certificates sqlite && \
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

# Copy the built binary from the builder stage
COPY --from=build /app/main .

# Copy the built frontend files
COPY --from=build /app/web ./web

# Set a default environment variable for the port
ENV PORT=${APP_PORT}

# Create volumes for persistent data
VOLUME ["/data", "/media"]

# Expose the application port
EXPOSE ${APP_PORT}

# Run the Go application as non-root user
USER nonroot:nonroot

# Run the Go application
CMD ["./main"]
