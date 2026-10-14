import React from 'react'
import { AlertTriangle } from 'lucide-react'

export function DisclaimerBanner() {
  return (
    <aside
      role="note"
      data-testid="disclaimer-banner"
      className="bg-amber-500/10 border-b border-amber-500/30 text-amber-950 dark:text-amber-200 px-4 py-2.5 text-xs sm:text-sm font-medium"
      aria-label="Experimental research prototype disclaimer"
    >
      <div className="container mx-auto max-w-7xl flex items-start sm:items-center gap-2.5">
        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 sm:mt-0" aria-hidden="true" />
        <p className="leading-relaxed">
          <strong className="font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300 mr-1.5">
            Research Prototype — DEMO DATA:
          </strong>
          NEXSTORM provides experimental relative waterlogging risk estimates based on simulated rainfall and synthetic placeholder susceptibility data. It does NOT provide verified street-level flood predictions, measured observations, or official emergency warnings. Consult IMD, NDMA, and local municipal disaster authorities for official emergency advisories.
        </p>
      </div>
    </aside>
  )
}
