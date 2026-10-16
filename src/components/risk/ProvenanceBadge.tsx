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
      className="rounded-2xl border border-slate-200/90 bg-white shadow-xs p-5 sm:p-6 space-y-4"
    >
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-800">
          <Database className="w-4 h-4 text-blue-600" />
          <span>Data Provenance & Traceability</span>
        </div>
        {isDemo && (
          <Badge
            data-testid="demo-data-badge"
            className="bg-slate-900 text-white font-bold text-[10px] tracking-wider uppercase px-2 py-0.5 rounded-md"
          >
            DEMO DATA
          </Badge>
        )}
      </div>

      <div className="space-y-3 text-xs">
        {provenance.map((item, idx) => (
          <div key={idx} className="flex items-start gap-3 border-l-2 border-blue-500 pl-3 py-1">
            <span className="font-mono text-xs text-blue-700 uppercase shrink-0 font-bold">
              [{item.kind}]
            </span>
            <div className="space-y-1 leading-snug">
              <span className="font-bold text-slate-900">{item.source}</span>
              {item.note && (
                <p className="text-xs text-slate-600 font-mono">
                  {item.note.replace(/[a-f0-9]{32,64}/gi, (hash) => `sha256:${hash.slice(0, 8)}…`)}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1.5 text-xs text-slate-500 pt-3 border-t border-slate-100">
        <Info className="w-3.5 h-3.5 shrink-0 text-slate-500" />
        <span>No official meteorological telemetry or surveyed city drainage networks are asserted.</span>
      </div>
    </div>
  )
}
