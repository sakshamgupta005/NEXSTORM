import { describe, it, expect } from 'vitest'
import { SECURITY_HEADERS, getNextSecurityHeadersConfig } from '@/lib/security/headers'

describe('Security Headers Configuration', () => {
  it('defines critical defense-in-depth HTTP security headers', () => {
    const headerMap = new Map(SECURITY_HEADERS.map((h) => [h.key, h.value]))

    expect(headerMap.get('X-Frame-Options')).toBe('DENY')
    expect(headerMap.get('X-Content-Type-Options')).toBe('nosniff')
    expect(headerMap.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
    expect(headerMap.get('Strict-Transport-Security')).toContain('max-age=63072000')
    expect(headerMap.get('Content-Security-Policy')).toContain("frame-ancestors 'none'")
  })

  it('formats next.config.ts headers configuration with wildcard route matcher', () => {
    const config = getNextSecurityHeadersConfig()
    expect(config).toHaveLength(1)
    expect(config[0]?.source).toBe('/(.*)')
    expect(config[0]?.headers).toHaveLength(SECURITY_HEADERS.length)
  })
})
