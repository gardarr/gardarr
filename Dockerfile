# Define build arguments for image tags and port
ARG GO_IMAGE=golang:1.24.4-alpine
ARG NODE_IMAGE=node:20-alpine
ARG APP_PORT=3000

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

# Stage 2: Build the Go application
FROM ${GO_IMAGE} AS build

# Install necessary dependencies and clean up in one layer
RUN apk add --no-cache git && \
    rm -rf /var/cache/apk/*

# Set the working directory inside the container
WORKDIR /app

# Copy Go modules manifests
COPY backend/go.mod backend/go.sum ./

# Download Go modules
RUN go mod download

# Copy the application source code
COPY backend/ .

# Copy built frontend from frontend-build stage
COPY --from=frontend-build /app/frontend/dist ./web

# Build the Go application with optimizations
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags='-w -s -extldflags "-static"' \
    -a -installsuffix cgo \
    -o main .

# Stage 3: Create a minimal runtime image using distroless
FROM gcr.io/distroless/static-debian12:nonroot

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

# Expose the application port
EXPOSE ${APP_PORT}

# Run the Go application as non-root user
USER nonroot:nonroot

# Run the Go application
CMD ["./main"]
