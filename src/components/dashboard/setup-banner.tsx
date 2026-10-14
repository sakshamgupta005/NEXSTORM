import { AlertTriangle, ExternalLink } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function SetupBanner() {
  return (
    <Card className="border-amber-300 dark:border-amber-900 bg-amber-50/70 dark:bg-amber-950/30 mb-8">
      <CardContent className="p-5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-amber-900 dark:text-amber-200">
                  Live Supabase Credentials Needed
                </h4>
                <Badge variant="warning">Setup Required</Badge>
              </div>
              <p className="mt-1 text-sm text-amber-800 dark:text-amber-300/90 leading-relaxed">
                You are viewing the starter dashboard in preview mode. To enable real database persistence, user registrations, and session verification, configure your Supabase credentials in <code className="rounded bg-amber-100 dark:bg-amber-900/60 px-1.5 py-0.5 text-xs font-mono">.env.local</code>.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <a
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-900 hover:text-amber-700 dark:text-amber-300 dark:hover:text-amber-200"
            >
              Supabase Dashboard
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
