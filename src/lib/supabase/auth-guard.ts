/**
 * Server Authentication & Authorization Guard
 * 
 * Capabilities:
 * - Server-verified session authentication via Supabase getUser()
 * - Safe unauthorized handling for Route Handlers and Server Actions
 * - Unconfigured fallback without pretending real auth succeeded
 */

import { createClient } from './server'
import { isSupabaseConfigured } from './config'
import type { User } from '@supabase/supabase-js'

export interface AuthGuardResult {
  user: User | null
  error?: string
  isConfigured: boolean
}

/**
 * Validates the current server session token with Supabase Auth.
 * Does NOT trust unverified cookies or client-side tokens.
 */
export async function requireServerUser(): Promise<AuthGuardResult> {
  if (!isSupabaseConfigured()) {
    return {
      user: null,
      error: 'Supabase credentials are not configured.',
      isConfigured: false,
    }
  }

  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return {
        user: null,
        error: error?.message || 'Authentication required.',
        isConfigured: true,
      }
    }

    return {
      user,
      isConfigured: true,
    }
  } catch (err) {
    return {
      user: null,
      error: err instanceof Error ? err.message : 'Authentication verification failed.',
      isConfigured: true,
    }
  }
}
