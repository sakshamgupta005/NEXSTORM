import React from 'react'
import type { Provenance } from '@/lib/risk/types'
import { Badge } from '@/components/ui/badge'
import { Database, Info } from 'lucide-react'

interface ProvenanceBadgeProps {
  provenance?: Provenance[]
  compact?: boolean
}

export function ProvenanceBadge({ provenance = [], compact = false }: ProvenanceBadgeProps) {
  const isDemo = provenance.some((p) => p.kind === 'simulated' || p.note?.includes('DEMO DATA'))

  if (compact) {
    return (
      <div className="inline-flex items-center gap-1.5" data-testid="provenance-badge">
        {isDemo && (
          <Badge
            data-testid="demo-data-badge"
            className="bg-purple-600 text-white font-semibold text-[10px] tracking-wider uppercase px-2 py-0.5"
          >
            DEMO DATA
          </Badge>
        )}
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Simulated Hyetograph + Seeded Grid
        </span>
      </div>
    )
  }

  return (
    <div
      data-testid="provenance-panel"
      className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 p-3.5 space-y-2 backdrop-blur-sm"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <Database className="w-3.5 h-3.5" />
          <span>Data Provenance & Traceability</span>
        </div>
        {isDemo && (
          <Badge
            data-testid="demo-data-badge"
            className="bg-purple-600 text-white font-semibold text-[10px] tracking-wider uppercase px-2 py-0.5"
          >
            DEMO DATA
          </Badge>
        )}
      </div>

      <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
        {provenance.map((item, idx) => (
          <div key={idx} className="flex items-start gap-2 border-l-2 border-purple-500/40 pl-2 py-0.5">
            <span className="font-mono text-[11px] text-purple-700 dark:text-purple-300 uppercase shrink-0 font-medium">
              [{item.kind}]
            </span>
            <div className="space-y-0.5 leading-snug">
              <span className="font-medium text-slate-800 dark:text-slate-200">{item.source}</span>
              {item.note && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{item.note}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800/80">
        <Info className="w-3 h-3 shrink-0" />
        <span>No official meteorological telemetry or surveyed city drainage networks are asserted.</span>
      </div>
    </div>
  )
}
