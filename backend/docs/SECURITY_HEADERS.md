# Security Headers Documentation

This document explains the security headers implemented in Gardarr to protect against common web vulnerabilities.

## Implemented Headers

### 1. Content Security Policy (CSP)
**Purpose**: Prevents XSS attacks by controlling which resources can be loaded.

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; ...
```

**Directives**:
- `default-src 'self'`: Only allow resources from the same origin by default
- `script-src 'self' 'unsafe-inline' 'unsafe-eval'`: Allow scripts from same origin and inline scripts (needed for React/Vite)
- `style-src 'self' 'unsafe-inline'`: Allow styles from same origin and inline styles (needed for Tailwind)
- `img-src 'self' data: blob: https:`: Allow images from same origin, data URIs, blobs, and HTTPS sources
- `font-src 'self' data:`: Allow fonts from same origin and data URIs
- `connect-src 'self' ws: wss:`: Allow API calls and WebSocket connections (needed for Vite HMR)
- `frame-ancestors 'none'`: Prevent the page from being embedded in iframes
- `base-uri 'self'`: Restrict URLs that can be used in `<base>` element
- `form-action 'self'`: Only allow form submissions to same origin
- `object-src 'none'`: Disallow Flash and other plugins
- `worker-src 'self' blob:`: Allow web workers from same origin and blobs
- `manifest-src 'self'`: Allow manifest files from same origin

**Production Note**: Consider removing `'unsafe-inline'` and `'unsafe-eval'` in production by using nonces or hashes.

### 2. X-Frame-Options
**Purpose**: Prevents clickjacking attacks.

```
X-Frame-Options: DENY
```

Prevents the page from being loaded in any iframe, frame, or object.

### 3. X-XSS-Protection
**Purpose**: Enables browser's XSS filter (legacy).

```
X-XSS-Protection: 1; mode=block
```

Tells the browser to block the page if XSS is detected. Modern browsers use CSP instead.

### 4. Strict-Transport-Security (HSTS)
**Purpose**: Forces HTTPS connections.

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

- `max-age=31536000`: Remember to use HTTPS for 1 year
- `includeSubDomains`: Apply to all subdomains
- `preload`: Allow inclusion in browser HSTS preload lists

**Important**: Only enable in production with proper HTTPS setup!

### 5. Referrer-Policy
**Purpose**: Controls how much referrer information is sent.

```
Referrer-Policy: strict-origin-when-cross-origin
```

Sends full URL for same-origin requests, but only origin for cross-origin requests.

### 6. X-Content-Type-Options
**Purpose**: Prevents MIME type sniffing.

```
X-Content-Type-Options: nosniff
```

Tells browsers to respect the `Content-Type` header and not try to guess the content type.

### 7. Permissions-Policy
**Purpose**: Controls which browser features can be used.

```
Permissions-Policy: geolocation=(), camera=(), microphone=(), ...
```

Disables sensitive browser features that Gardarr doesn't need:
- `geolocation`: GPS location
- `camera`: Camera access
- `microphone`: Microphone access
- `payment`: Payment API
- `fullscreen=(self)`: Only allow fullscreen from same origin

### 8. Cross-Origin Policies
**Purpose**: Protects against cross-origin attacks.

```
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
```

- **COEP**: Requires resources to be explicitly marked for cross-origin loading
- **COOP**: Isolates browsing context from other origins
- **CORP**: Prevents resources from being loaded by other origins

## Testing

You can test the security headers using:

1. **Browser DevTools**: Check the Network tab → Response Headers
2. **SecurityHeaders.com**: https://securityheaders.com/
3. **Mozilla Observatory**: https://observatory.mozilla.org/

Example using curl:
```bash
curl -I http://localhost:3000
```

## Maintenance

### Development vs Production

Some CSP directives may need adjustment based on environment:

**Development**:
- `'unsafe-inline'` and `'unsafe-eval'` are needed for Vite HMR
- `ws:` and `wss:` are needed for WebSocket connections

**Production**:
- Consider removing `'unsafe-inline'` and `'unsafe-eval'`
- Use nonces or hashes for inline scripts
- Ensure HTTPS is properly configured for HSTS

### Adding New Resources

If you need to load resources from external sources:

1. **CDN**: Add the domain to the appropriate CSP directive
   ```go
   "script-src 'self' https://cdn.example.com"
   ```

2. **API**: Add to `connect-src`
   ```go
   "connect-src 'self' https://api.example.com"
   ```

3. **Images**: Add to `img-src`
   ```go
   "img-src 'self' https://images.example.com"
   ```

## Security Best Practices

1. **Regular Audits**: Review security headers quarterly
2. **Test Changes**: Always test CSP changes in staging first
3. **Monitor Violations**: Implement CSP reporting in production
4. **Keep Updated**: Follow OWASP guidelines and security advisories
5. **HTTPS Only**: Never disable HSTS in production

## References

- [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/)
- [Content Security Policy Reference](https://content-security-policy.com/)
- [MDN Web Security](https://developer.mozilla.org/en-US/docs/Web/Security)
- [SecurityHeaders.com](https://securityheaders.com/)

## Contributing

When adding new features that require external resources:

1. Document why the resource is needed
2. Add the most restrictive CSP directive possible
3. Test thoroughly in development
4. Update this documentation
5. Get security review before production deployment

