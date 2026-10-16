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
      className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs p-6 sm:p-7 space-y-4"
    >
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
          <Database className="w-4 h-4 text-purple-600" />
          <span>Data Provenance & Traceability</span>
        </div>
        {isDemo && (
          <Badge
            data-testid="demo-data-badge"
            className="bg-purple-600 text-white font-bold text-[10px] tracking-wider uppercase px-2 py-0.5"
          >
            DEMO DATA
          </Badge>
        )}
      </div>

      <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
        {provenance.map((item, idx) => (
          <div key={idx} className="flex items-start gap-3 border-l-2 border-purple-500/60 pl-3 py-1">
            <span className="font-mono text-xs text-purple-700 dark:text-purple-300 uppercase shrink-0 font-bold">
              [{item.kind}]
            </span>
            <div className="space-y-1 leading-snug">
              <span className="font-semibold text-slate-800 dark:text-slate-200">{item.source}</span>
              {item.note && (
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  {item.note.replace(/[a-f0-9]{32,64}/gi, (hash) => `sha256:${hash.slice(0, 8)}…`)}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 pt-3 border-t border-slate-100 dark:border-slate-800">
        <Info className="w-3.5 h-3.5 shrink-0 text-slate-400" />
        <span>No official meteorological telemetry or surveyed city drainage networks are asserted.</span>
      </div>
    </div>
  )
}
