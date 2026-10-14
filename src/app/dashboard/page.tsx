import { redirect } from 'next/navigation'
import { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { DashboardShell } from '@/components/layout/dashboard-shell'
import { OverviewCards } from '@/components/dashboard/overview-cards'
import { ProjectPlaceholder } from '@/components/dashboard/project-placeholder'
import { SetupBanner } from '@/components/dashboard/setup-banner'
import type { User } from '@supabase/supabase-js'

export const metadata: Metadata = {
  title: 'Dashboard | Hackathon Starter',
  description: 'Application workspace and starter dashboard',
}

export default async function DashboardPage() {
  const isConfigured = isSupabaseConfigured()
  let user: User | null = null

  if (isConfigured) {
    const supabase = await createClient()
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()

    if (!authUser) {
      redirect('/login?redirectTo=/dashboard')
    }
    user = authUser
  }

  return (
    <DashboardShell user={user}>
      {!isConfigured && <SetupBanner />}
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Welcome to your Hackathon Workspace
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isConfigured
              ? `Signed in as ${user?.email}`
              : 'Development preview mode — Supabase configuration pending'}
          </p>
        </div>

        <OverviewCards isConfigured={isConfigured} userEmail={user?.email} />

        <ProjectPlaceholder />
      </div>
    </DashboardShell>
  )
}
