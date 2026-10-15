import React from 'react'
import { AlertTriangle } from 'lucide-react'

export function DisclaimerBanner() {
  return (
    <aside
      role="note"
      data-testid="disclaimer-banner"
      className="bg-amber-500/10 border-b border-amber-500/25 text-amber-950 dark:text-amber-200 px-4 py-2 text-xs font-medium"
      aria-label="Experimental research prototype disclaimer"
    >
      <div className="mx-auto max-w-[1440px] px-4 sm:px-8 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
          <p className="leading-tight text-[11px] sm:text-xs">
            <strong className="font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 mr-1.5">
              Research Prototype — DEMO DATA:
            </strong>
            <span>
              NEXSTORM provides experimental relative waterlogging risk estimates based on simulated rainfall and synthetic placeholder susceptibility data. Consult IMD, NDMA, and local municipal authorities for official emergency advisories.
            </span>
          </p>
        </div>
      </div>
    </aside>
  )
}
