import React from 'react'
import { AlertTriangle } from 'lucide-react'

export function DisclaimerBanner() {
  return (
    <aside
      role="note"
      data-testid="disclaimer-banner"
      className="bg-amber-500/10 border-b border-amber-500/25 text-amber-950 px-4 py-2.5 text-xs font-medium"
      aria-label="Experimental research prototype disclaimer"
    >
      <div className="mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />
          <p className="leading-tight text-xs text-amber-950">
            <strong className="font-bold uppercase tracking-wider text-amber-900 mr-1.5">
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
