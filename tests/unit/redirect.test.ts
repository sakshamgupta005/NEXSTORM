import { describe, it, expect } from 'vitest'
import { isSafeRedirectPath, getSafeRedirectPath } from '@/lib/utils/redirect'

describe('Safe Redirect Path Validator (src/lib/utils/redirect.ts)', () => {
  describe('isSafeRedirectPath', () => {
    it('accepts safe internal relative paths', () => {
      expect(isSafeRedirectPath('/')).toBe(true)
      expect(isSafeRedirectPath('/dashboard')).toBe(true)
      expect(isSafeRedirectPath('/dashboard/settings')).toBe(true)
      expect(isSafeRedirectPath('/dashboard?view=metrics&filter=active')).toBe(true)
      expect(isSafeRedirectPath('/profile#section-2')).toBe(true)
    })

    it('rejects external absolute URLs', () => {
      expect(isSafeRedirectPath('https://evil.com')).toBe(false)
      expect(isSafeRedirectPath('http://evil.com')).toBe(false)
      expect(isSafeRedirectPath('http://localhost:3000')).toBe(false)
      expect(isSafeRedirectPath('https://attacker.com/dashboard')).toBe(false)
    })

    it('rejects protocol-relative URLs', () => {
      expect(isSafeRedirectPath('//evil.com')).toBe(false)
      expect(isSafeRedirectPath('//evil.com/path')).toBe(false)
      expect(isSafeRedirectPath('///evil.com')).toBe(false)
    })

    it('rejects backslash bypasses', () => {
      expect(isSafeRedirectPath('/\\evil.com')).toBe(false)
      expect(isSafeRedirectPath('\\evil.com')).toBe(false)
      expect(isSafeRedirectPath('/path\\to\\somewhere')).toBe(false)
    })

    it('rejects dangerous URI schemes and pseudo-schemes', () => {
      expect(isSafeRedirectPath('javascript:alert(1)')).toBe(false)
      expect(isSafeRedirectPath('/javascript:alert(1)')).toBe(false)
      expect(isSafeRedirectPath('data:text/html,<script>alert(1)</script>')).toBe(false)
      expect(isSafeRedirectPath('vbscript:msgbox(1)')).toBe(false)
    })

    it('rejects empty, null, undefined, or whitespace-only inputs', () => {
      expect(isSafeRedirectPath(undefined)).toBe(false)
      expect(isSafeRedirectPath(null)).toBe(false)
      expect(isSafeRedirectPath('')).toBe(false)
      expect(isSafeRedirectPath('   ')).toBe(false)
    })

    it('rejects inputs with control characters', () => {
      expect(isSafeRedirectPath('/dashboard\n')).toBe(false)
      expect(isSafeRedirectPath('/dashboard\r\n')).toBe(false)
      expect(isSafeRedirectPath('/dashboard\x00')).toBe(false)
    })
  })

  describe('getSafeRedirectPath', () => {
    it('returns the input path if safe', () => {
      expect(getSafeRedirectPath('/dashboard/modules')).toBe('/dashboard/modules')
      expect(getSafeRedirectPath('/settings?tab=general')).toBe('/settings?tab=general')
    })

    it('returns default fallback (/dashboard) for unsafe or missing input', () => {
      expect(getSafeRedirectPath('https://evil.com')).toBe('/dashboard')
      expect(getSafeRedirectPath('//evil.com')).toBe('/dashboard')
      expect(getSafeRedirectPath(null)).toBe('/dashboard')
      expect(getSafeRedirectPath(undefined)).toBe('/dashboard')
      expect(getSafeRedirectPath('')).toBe('/dashboard')
    })

    it('returns custom fallback if provided and safe', () => {
      expect(getSafeRedirectPath('https://evil.com', '/home')).toBe('/home')
      expect(getSafeRedirectPath(undefined, '/overview')).toBe('/overview')
    })

    it('falls back to /dashboard if custom fallback is also unsafe', () => {
      expect(getSafeRedirectPath('https://evil.com', 'https://another-evil.com')).toBe(
        '/dashboard'
      )
    })
  })
})
