import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import {
  getNestedValue,
  setNestedValue,
  validateWithZod,
  mapServerErrors,
  validateFileSafety,
  detectMagicType,
} from '@/lib/forms'

describe('Forms & Validation Toolkit - Unit Tests', () => {
  describe('Nested Object Path Utilities', () => {
    it('retrieves nested and array values via dotted paths', () => {
      const data = {
        user: {
          profile: {
            name: 'Sam',
          },
          emails: ['sam@example.com', 'work@example.com'],
        },
      }

      expect(getNestedValue(data, 'user.profile.name')).toBe('Sam')
      expect(getNestedValue(data, 'user.emails.1')).toBe('work@example.com')
      expect(getNestedValue(data, 'user.missing.key')).toBeUndefined()
      expect(getNestedValue(null, 'foo')).toBeUndefined()
    })

    it('sets nested values immutably without mutating original source', () => {
      const original = { user: { name: 'Alex' } }
      const updated = setNestedValue(original, 'user.name', 'Morgan')

      expect(updated.user.name).toBe('Morgan')
      expect(original.user.name).toBe('Alex')

      const withArray = setNestedValue({ items: ['a', 'b'] }, 'items.1', 'z')
      expect(withArray.items[1]).toBe('z')
    })
  })

  describe('Zod Schema Resolver', () => {
    const userSchema = z.object({
      username: z.string().min(3, 'Username must be at least 3 characters'),
      email: z.string().email('Invalid email address'),
      meta: z.object({
        role: z.enum(['admin', 'user'], { message: 'Invalid role' }),
      }),
    })

    it('returns parsed values when input satisfies schema', async () => {
      const valid = {
        username: 'alice',
        email: 'alice@example.com',
        meta: { role: 'admin' },
      }

      const result = await validateWithZod(userSchema, valid)
      expect(result.values).toEqual(valid)
      expect(result.errors).toBeUndefined()
    })

    it('maps validation issues to field paths', async () => {
      const invalid = {
        username: 'ab',
        email: 'not-an-email',
        meta: { role: 'superadmin' },
      }

      const result = await validateWithZod(userSchema, invalid)
      expect(result.errors).toBeDefined()
      expect(result.errors?.username).toBe('Username must be at least 3 characters')
      expect(result.errors?.email).toBe('Invalid email address')
      expect(result.errors?.['meta.role']).toBe('Invalid role')
    })
  })

  describe('Server Error Mapping', () => {
    it('maps string errors to _form key', () => {
      const res = mapServerErrors('Unauthorized action')
      expect(res._form).toBe('Unauthorized action')
    })

    it('maps nested details object from 422 responses', () => {
      const res = mapServerErrors({
        details: {
          title: 'Title must be unique',
          category: 'Category is inactive',
        },
      })

      expect(res.title).toBe('Title must be unique')
      expect(res.category).toBe('Category is inactive')
    })

    it('maps array errors with field paths', () => {
      const res = mapServerErrors({
        errors: [
          { field: 'email', message: 'Already exists' },
          { field: 'password', message: 'Too weak' },
        ],
      })

      expect(res.email).toBe('Already exists')
      expect(res.password).toBe('Too weak')
    })

    it('falls back to message or error property', () => {
      expect(mapServerErrors({ message: 'Database connection failed' })._form).toBe(
        'Database connection failed'
      )
      expect(mapServerErrors({ error: 'Service Unavailable' })._form).toBe(
        'Service Unavailable'
      )
    })
  })

  describe('File Safety & Magic Bytes Validation', () => {
    it('enforces maximum file size limit', async () => {
      const mockFile = new File(['a'.repeat(2048)], 'test.txt', { type: 'text/plain' })
      const res = await validateFileSafety(mockFile, { maxSizeBytes: 1024 })

      expect(res.isValid).toBe(false)
      expect(res.error).toContain('exceeds maximum limit')
    })

    it('enforces extension whitelisting', async () => {
      const mockFile = new File(['content'], 'malicious.exe', {
        type: 'application/x-msdownload',
      })
      const res = await validateFileSafety(mockFile, {
        allowedExtensions: ['.pdf', '.png'],
      })

      expect(res.isValid).toBe(false)
      expect(res.error).toContain('not permitted')
    })

    it('enforces MIME type whitelisting', async () => {
      const mockFile = new File(['content'], 'test.html', { type: 'text/html' })
      const res = await validateFileSafety(mockFile, {
        allowedMimeTypes: ['image/png', 'application/pdf'],
      })

      expect(res.isValid).toBe(false)
      expect(res.error).toContain('not supported')
    })

    it('detects magic bytes for valid PNG file', async () => {
      // PNG header: 89 50 4E 47
      const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      const pngFile = new File([pngBytes], 'graphic.png', { type: 'image/png' })

      const detected = await detectMagicType(pngFile)
      expect(detected).toBe('image/png')

      const validation = await validateFileSafety(pngFile, {
        allowedMimeTypes: ['image/png'],
        verifyMagicBytes: true,
      })
      expect(validation.isValid).toBe(true)
    })

    it('rejects spoofed file where extension/MIME claims PNG but binary header does not match', async () => {
      // Fake PNG containing plain text
      const fakeFile = new File(['just plain text spoofing png'], 'graphic.png', {
        type: 'image/png',
      })

      const validation = await validateFileSafety(fakeFile, {
        allowedMimeTypes: ['image/png'],
        verifyMagicBytes: true,
      })

      expect(validation.isValid).toBe(false)
      expect(validation.error).toContain('Possible extension spoofing')
    })
  })
})
