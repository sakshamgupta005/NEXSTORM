import { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { DashboardShell } from '@/components/layout/dashboard-shell'
import { FormDemo } from '@/components/forms/form-demo'
import type { User } from '@supabase/supabase-js'

export const metadata: Metadata = {
  title: 'Forms & Validation | Hackathon Starter',
  description: 'Type-safe forms, Zod validation, multi-step stepper, dynamic field arrays, and safe file uploads.',
}

export default async function FormsDashboardPage() {
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
      <FormDemo />
    </DashboardShell>
  )
}
