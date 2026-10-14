'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  React.useEffect(() => {
    // Optionally log error in production monitoring
  }, [error])

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center p-4 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400">
        <AlertTriangle className="h-7 w-7" />
      </div>
      <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
        Something went wrong
      </h2>
      <p className="mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400">
        An unexpected application error occurred. You can retry the action or reload the page.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <Button onClick={() => reset()} size="sm" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Try Again
        </Button>
      </div>
    </div>
  )
}
