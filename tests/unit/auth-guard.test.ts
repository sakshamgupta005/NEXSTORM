import { describe, it, expect, vi, beforeEach } from 'vitest'
import { requireServerUser } from '@/lib/supabase/auth-guard'
import * as supabaseConfig from '@/lib/supabase/config'
import * as supabaseServer from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'

describe('requireServerUser Auth Guard', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns unconfigured status when Supabase environment variables are missing', async () => {
    vi.spyOn(supabaseConfig, 'isSupabaseConfigured').mockReturnValue(false)

    const result = await requireServerUser()
    expect(result.user).toBeNull()
    expect(result.isConfigured).toBe(false)
    expect(result.error).toContain('Supabase credentials are not configured')
  })

  it('returns authenticated user when Supabase verifies session token', async () => {
    vi.spyOn(supabaseConfig, 'isSupabaseConfigured').mockReturnValue(true)

    const mockUser = { id: 'usr_123', email: 'test@example.com' } as User
    vi.spyOn(supabaseServer, 'createClient').mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
      },
    } as unknown as Awaited<ReturnType<typeof supabaseServer.createClient>>)

    const result = await requireServerUser()
    expect(result.user).toEqual(mockUser)
    expect(result.isConfigured).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('returns unauthorized when Supabase getUser() returns an error', async () => {
    vi.spyOn(supabaseConfig, 'isSupabaseConfigured').mockReturnValue(true)

    vi.spyOn(supabaseServer, 'createClient').mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: { message: 'JWT expired' } }),
      },
    } as unknown as Awaited<ReturnType<typeof supabaseServer.createClient>>)

    const result = await requireServerUser()
    expect(result.user).toBeNull()
    expect(result.isConfigured).toBe(true)
    expect(result.error).toBe('JWT expired')
  })
})
