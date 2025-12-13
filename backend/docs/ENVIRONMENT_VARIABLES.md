# Environment Variables

This document lists all environment variables used by Gardarr backend.

## Application Configuration

### `APP_PORT`
- **Description**: Port number where the server will listen
- **Default**: `3000`
- **Example**: `APP_PORT=8080`

### `GIN_MODE`
- **Description**: Gin framework mode
- **Values**: `debug` (development) or `release` (production)
- **Default**: `debug`
- **Example**: `GIN_MODE=release`
- **Note**: In release mode, HSTS header is automatically enabled

### `APP_MODE`
- **Description**: Application mode for agent management
- **Values**: `standalone` (adds mock standalone agent and starts agent service) or any other value (normal mode)
- **Default**: Not set (normal mode)
- **Example**: `APP_MODE=standalone`
- **Note**: When set to `standalone`:
  - Adds a mock agent with URL `http://127.0.0.1:3100`, icon `MemoryStick`, and name `Standalone`
  - Automatically starts the agent service on port 3100
  - Both service and agent run together in the same process

## CORS Configuration

### `APP_URL`
- **Description**: The public URL of the application. Used for CORS configuration to allow requests from the frontend.
- **Default**: `http://localhost:3000`
- **Example**: `APP_URL=https://gardarr.example.com`
- **Note**: This URL is added to the list of allowed origins for CORS.

## Security Configuration

### `CUSTOM_CSP` (Optional)
- **Description**: Custom Content Security Policy override
- **Default**: Uses built-in secure CSP
- **Example**: `CUSTOM_CSP="default-src 'self'; script-src 'self' 'unsafe-inline'"`
- **Use Case**: Only use if you need to customize CSP for specific requirements

## Standalone Mode

When `APP_MODE=standalone` is set, the application will:

1. **Start both services**: The main service and the agent service run together
2. **Add mock agent**: A standalone agent is automatically added to the agents list
3. **Use different ports**: 
   - Service runs on the port specified by `APP_PORT` (default: 3000)
   - Agent runs on the port specified by `AGENT_PORT` (default: 3100)
4. **Automatic setup**: No need to manually start the agent service

### Standalone Mode Configuration
```bash
APP_MODE=standalone
APP_PORT=3000
AGENT_PORT=3100
AGENT_SECRET=standalone-secret-key
```

### Running in Standalone Mode
```bash
# Using the provided script
./scripts/standalone.sh

# Or manually
export APP_MODE=standalone
./gardarr
```

## Example Configuration Files

### Development (`.env.development`)
```bash
APP_PORT=3000
GIN_MODE=debug
APP_URL=http://localhost:3000
# APP_MODE=standalone  # Uncomment to enable standalone mode
```

### Production (`.env.production`)
```bash
APP_PORT=3000
GIN_MODE=release
APP_URL=https://gardarr.example.com
# HTTPS must be configured when GIN_MODE=release (HSTS enabled)
```

## Security Considerations

1. **Never commit** `.env` files to version control
2. **Use different** configurations for dev/staging/production
3. **Restrict CORS** in production to only your domain(s)
4. **Enable HTTPS** in production before setting `GIN_MODE=release`
5. **Review CSP** settings if you add external resources

## Production Checklist

Before deploying to production:

- [ ] Set `GIN_MODE=release`
- [ ] Configure `APP_URL` with production url only
- [ ] Ensure HTTPS/TLS is properly configured
- [ ] Review and test security headers
- [ ] Configure proper database credentials
- [ ] Set up monitoring and logging
- [ ] Test CORS configuration
- [ ] Verify CSP doesn't block required resources

## Debugging

To test which environment variables are active:

```bash
# Print all environment variables
env | grep -E "APP_|GIN_MODE|CUSTOM_CSP"

# Check if production mode is enabled
if [ "$GIN_MODE" = "release" ]; then
    echo "Running in PRODUCTION mode"
else
    echo "Running in DEVELOPMENT mode"
fi
```

## Related Documentation

- [SECURITY_HEADERS.md](./SECURITY_HEADERS.md) - Detailed security headers documentation
- [CORS Configuration](https://github.com/gin-contrib/cors) - CORS middleware documentation

