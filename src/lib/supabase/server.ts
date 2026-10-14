import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSupabaseEnv } from './config'

export async function createClient() {
  const cookieStore = await cookies()
  const { url, anonKey, isConfigured } = getSupabaseEnv()

  return createServerClient(
    isConfigured ? url : 'https://placeholder-project.supabase.co',
    isConfigured ? anonKey : 'placeholder-anon-key',
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
          }
        },
      },
    }
  )
}
