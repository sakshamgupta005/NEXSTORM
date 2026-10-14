/**
 * HTTP Security Headers Configuration
 * 
 * Capabilities:
 * - Defense-in-depth headers for clickjacking, MIME sniffing, and cross-site leaks
 * - Compatible Content-Security-Policy (CSP) that supports Next.js Turbopack dev & SSR
 * - Standardized format for next.config.ts `headers()`
 */

export interface SecurityHeader {
  key: string
  value: string
}

export const SECURITY_HEADERS: SecurityHeader[] = [
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https: wss:",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
]

export function getNextSecurityHeadersConfig() {
  return [
    {
      source: '/(.*)',
      headers: SECURITY_HEADERS,
    },
  ]
}
