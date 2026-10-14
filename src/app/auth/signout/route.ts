import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'

export async function POST(request: Request) {
  if (isSupabaseConfigured()) {
    const supabase = await createClient()
    await supabase.auth.signOut()
  }

  const { origin } = new URL(request.url)
  return NextResponse.redirect(`${origin}/login`, {
    status: 302,
  })
}
