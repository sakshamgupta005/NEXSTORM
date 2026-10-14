import { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { DashboardShell } from '@/components/layout/dashboard-shell'
import { DemoDashboard } from '@/components/visualization/demo-dashboard'
import type { User } from '@supabase/supabase-js'

export const metadata: Metadata = {
  title: 'Analytics & Visualizations | Hackathon Starter',
  description: 'Interactive telemetry, metrics, and visualization dashboard toolkit demo',
}

export default async function AnalyticsDashboardPage() {
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
      // Allow preview in non-authenticated dev mode
    }
  }

  return (
    <DashboardShell user={user}>
      <DemoDashboard />
    </DashboardShell>
  )
}
