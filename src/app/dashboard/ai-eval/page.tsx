import { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { DashboardShell } from '@/components/layout/dashboard-shell'
import { EvalDashboard } from '@/components/ai-eval'
import type { User } from '@supabase/supabase-js'

export const metadata: Metadata = {
  title: 'AI Evaluation & Benchmarking | Hackathon Starter',
  description: 'Evaluate AI feature quality, compare model configurations, verify RAG grounding, and catch regressions without paid API lock-in.',
}

export default async function AiEvalDashboardPage() {
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
      <EvalDashboard />
    </DashboardShell>
  )
}
