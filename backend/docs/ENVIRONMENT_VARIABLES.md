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

## CORS Configuration

### `APP_DOMAINS`
- **Description**: Comma-separated list of allowed origins for CORS
- **Default**: `http://localhost:5173,http://localhost:3000`
- **Example**: `APP_DOMAINS=https://gardarr.example.com,https://app.example.com`
- **Production**: Set to your production domains only

## Security Configuration

### `CUSTOM_CSP` (Optional)
- **Description**: Custom Content Security Policy override
- **Default**: Uses built-in secure CSP
- **Example**: `CUSTOM_CSP="default-src 'self'; script-src 'self' 'unsafe-inline'"`
- **Use Case**: Only use if you need to customize CSP for specific requirements

## Example Configuration Files

### Development (`.env.development`)
```bash
APP_PORT=3000
GIN_MODE=debug
APP_DOMAINS=http://localhost:5173,http://localhost:3000
```

### Production (`.env.production`)
```bash
APP_PORT=3000
GIN_MODE=release
APP_DOMAINS=https://gardarr.example.com
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
- [ ] Configure `APP_DOMAINS` with production domains only
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

