import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  isValidEnvValue,
  requireServerEnv,
  getServerEnv,
  isEnvConfigured,
  inspectEnvironment,
  ConfigurationError,
} from '@/lib/env'

describe('Environment Validation Module (src/lib/env.ts)', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('isValidEnvValue', () => {
    it('returns false for undefined, null, or empty string', () => {
      expect(isValidEnvValue(undefined)).toBe(false)
      expect(isValidEnvValue('')).toBe(false)
      expect(isValidEnvValue('   ')).toBe(false)
    })

    it('returns false for known template placeholders', () => {
      expect(isValidEnvValue('your-key-here')).toBe(false)
      expect(isValidEnvValue('YOUR-API-KEY-HERE')).toBe(false)
      expect(isValidEnvValue('https://your-project-ref.supabase.co')).toBe(false)
      expect(isValidEnvValue('sk-xxx12345')).toBe(false)
    })

    it('returns true for genuine custom keys', () => {
      expect(isValidEnvValue('AIzaSyD-1234567890abcdef')).toBe(true)
      expect(isValidEnvValue('sk-proj-abc123xyz789')).toBe(true)
    })
  })

  describe('requireServerEnv', () => {
    it('throws ConfigurationError naming the missing variable without crashing', () => {
      delete process.env.OPENAI_API_KEY

      expect(() => requireServerEnv('OPENAI_API_KEY', 'Embeddings')).toThrowError(
        ConfigurationError
      )

      try {
        requireServerEnv('OPENAI_API_KEY', 'Embeddings')
      } catch (err: unknown) {
        const error = err as ConfigurationError
        expect(error.variableName).toBe('OPENAI_API_KEY')
        expect(error.message).toContain('Missing required environment variable: "OPENAI_API_KEY"')
        expect(error.message).toContain('to use Embeddings')
        expect(error.message).not.toContain('undefined')
      }
    })

    it('returns valid trimmed secret when configured', () => {
      process.env.ANTHROPIC_API_KEY = '  sk-ant-valid-key-998877  '
      const key = requireServerEnv('ANTHROPIC_API_KEY')
      expect(key).toBe('sk-ant-valid-key-998877')
    })
  })

  describe('getServerEnv and isEnvConfigured', () => {
    it('returns undefined safely when optional key is not set', () => {
      delete process.env.GROQ_API_KEY
      expect(getServerEnv('GROQ_API_KEY')).toBeUndefined()
      expect(isEnvConfigured('GROQ_API_KEY')).toBe(false)
    })

    it('supports NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY fallback to ANON_KEY', () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'ey-anon-token-123'

      expect(isEnvConfigured('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')).toBe(true)
    })
  })

  describe('inspectEnvironment', () => {
    it('reports status without leaking secret values', () => {
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'super-secret-gemini-key'
      const statuses = inspectEnvironment()

      const gemini = statuses.find((s) => s.key === 'GOOGLE_GENERATIVE_AI_API_KEY')
      expect(gemini).toBeDefined()
      expect(gemini?.isConfigured).toBe(true)

      // Confirm no value field exists in the returned structure
      expect(JSON.stringify(statuses)).not.toContain('super-secret-gemini-key')
    })
  })
})
