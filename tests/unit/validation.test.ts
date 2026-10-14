import { describe, it, expect } from 'vitest'
import { loginSchema, signupSchema } from '@/lib/validations/auth'

describe('Authentication Validation Schemas', () => {
  describe('loginSchema', () => {
    it('validates correct email and password', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: 'password123',
      })
      expect(result.success).toBe(true)
    })

    it('rejects invalid email', () => {
      const result = loginSchema.safeParse({
        email: 'invalid-email',
        password: 'password123',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('valid email')
      }
    })

    it('rejects password shorter than 6 characters', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: '123',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('at least 6 characters')
      }
    })
  })

  describe('signupSchema', () => {
    it('validates matching passwords', () => {
      const result = signupSchema.safeParse({
        email: 'dev@hackathon.io',
        password: 'securePassword1',
        confirmPassword: 'securePassword1',
      })
      expect(result.success).toBe(true)
    })

    it('rejects mismatched passwords', () => {
      const result = signupSchema.safeParse({
        email: 'dev@hackathon.io',
        password: 'password123',
        confirmPassword: 'differentPassword',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('Passwords do not match')
      }
    })
  })
})
