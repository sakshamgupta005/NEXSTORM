'use client'

import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Map, AlertCircle } from 'lucide-react'

export function PunjabOverview() {
  const coverageTiers = [
    {
      tier: 'Tier 1: Operational Pilot',
      district: 'Amritsar District',
      coverage: '1,998 city cells (250m) + 699 GNDU cells (50m)',
      status: 'Operational Model',
      badgeClass: 'bg-emerald-600 text-white',
      notes: 'Calibrated Copernicus DEM-derived susceptibility, road proxy, 15 validated incident hotspots.',
    },
    {
      tier: 'Tier 2: Candidate Cities',
      district: 'Ludhiana, Jalandhar, Patiala, Bathinda, Mohali',
      coverage: 'None (Unmodeled)',
      status: 'No Model Coverage',
      badgeClass: 'text-amber-700 dark:text-amber-400 border-amber-400/50',
      notes: 'No micro-grid deployed. Local municipal drain GIS and DEM hydrologic sink conditioning required.',
    },
    {
      tier: 'Tier 3: Statewide Context',
      district: 'Remaining 17 Punjab Districts',
      coverage: 'Regional Weather Alerts Only',
      status: 'Context Only',
      badgeClass: 'text-slate-600 dark:text-slate-400',
      notes: 'Statewide NDMA SACHET CAP emergency bulletins and district-level rainfall telemetry only.',
    },
  ]

  return (
    <Card className="border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-sm">
      <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Map className="w-4 h-4 text-blue-500" />
              <span>Punjab Regional Scope &amp; Pilot Boundary</span>
            </CardTitle>
            <Badge variant="outline" className="text-[10px] font-mono">
              Amritsar-First
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-3 text-xs">
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs leading-relaxed flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong>Geographic Boundary Enforcement:</strong> NEXSTORM&apos;s hydrometeorological risk matrix is calibrated specifically for the flat terrain and drainage characteristics of Amritsar. Do not extrapolate Amritsar model results to other Punjab districts without local topographic survey data, depression hierarchy modeling, and municipal drainage records.
          </div>
        </div>

        {/* Tiers Breakdown */}
        <div className="space-y-2 pt-1">
          {coverageTiers.map((item) => (
            <div
              key={item.tier}
              className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 space-y-1.5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <span className="font-bold text-xs">{item.tier}:</span>
                  <span className="text-slate-600 dark:text-slate-400 font-normal">{item.district}</span>
                </div>
                <Badge className={`text-[10px] font-mono ${item.badgeClass}`}>
                  {item.status}
                </Badge>
              </div>

              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                <strong>Coverage:</strong> {item.coverage}
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                {item.notes}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
