import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { isSupabaseConfigured, getSupabaseEnv } from '@/lib/supabase/config'

describe('Supabase Configuration Helpers', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('returns false when environment variables are missing', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    expect(isSupabaseConfigured()).toBe(false)
    const env = getSupabaseEnv()
    expect(env.isConfigured).toBe(false)
  })

  it('returns false when placeholder values are used', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://your-project-ref.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'your-anon-key-here'

    expect(isSupabaseConfigured()).toBe(false)
  })

  it('returns true when valid custom credentials are provided', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://xyzcompany.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummykey'

    expect(isSupabaseConfigured()).toBe(true)
    const env = getSupabaseEnv()
    expect(env.isConfigured).toBe(true)
    expect(env.url).toBe('https://xyzcompany.supabase.co')
  })
})
