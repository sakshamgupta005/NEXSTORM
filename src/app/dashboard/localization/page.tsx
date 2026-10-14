import { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { DashboardShell } from '@/components/layout/dashboard-shell'
import { I18nProvider } from '@/lib/i18n/context'
import { LiveAnnouncer } from '@/lib/a11y/announcer'
import { LocaleDemo } from '@/components/i18n/locale-demo'
import type { User } from '@supabase/supabase-js'

export const metadata: Metadata = {
  title: 'Internationalization & Accessibility | Hackathon Starter',
  description: 'Multilingual translations, locale-aware formatting, and accessible screen-reader UI demo',
}

export default async function LocalizationDashboardPage() {
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
      <I18nProvider>
        <LiveAnnouncer>
          <LocaleDemo />
        </LiveAnnouncer>
      </I18nProvider>
    </DashboardShell>
  )
}
