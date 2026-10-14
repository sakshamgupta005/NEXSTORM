import { createBrowserClient } from '@supabase/ssr'
import { getSupabaseEnv } from './config'

export function createClient() {
  const { url, anonKey, isConfigured } = getSupabaseEnv()

  return createBrowserClient(
    isConfigured ? url : 'https://placeholder-project.supabase.co',
    isConfigured ? anonKey : 'placeholder-anon-key'
  )
}
