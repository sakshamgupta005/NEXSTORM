/**
 * Checks whether Supabase environment variables are properly configured.
 * Supports both NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and NEXT_PUBLIC_SUPABASE_ANON_KEY.
 */
export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ''

  const placeholders = [
    'https://your-project-ref.supabase.co',
    'your-publishable-key-here',
    'your-anon-key-here',
    'placeholder',
  ]

  const isConfigured = Boolean(
    url.trim().length > 0 &&
    publishableKey.trim().length > 0 &&
    !placeholders.some((p) => url.includes(p) || publishableKey.includes(p))
  )

  return { url, anonKey: publishableKey, isConfigured }
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseEnv().isConfigured
}
