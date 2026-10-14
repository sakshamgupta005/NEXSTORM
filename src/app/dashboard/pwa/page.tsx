import { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { DashboardShell } from '@/components/layout/dashboard-shell'
import { PwaDemo } from '@/components/pwa/pwa-demo'
import type { User } from '@supabase/supabase-js'

export const metadata: Metadata = {
  title: 'PWA & Offline Support | Hackathon Starter',
  description: 'Progressive Web App installation, offline caching, IndexedDB persistence, and queue auto-sync demo.',
}

export default async function PwaDashboardPage() {
  const isConfigured = isSupabaseConfigured()
  let user: User | null = null

  if (isConfigured) {
    try {
      const supabase = await createClient()
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()
      user = authUser
    } catch {
      // Non-configured development fallback
    }
  }

  return (
    <DashboardShell user={user}>
      <PwaDemo />
    </DashboardShell>
  )
}
