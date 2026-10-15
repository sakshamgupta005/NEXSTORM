'use client'

import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { AlertTriangle, BookOpen, XCircle, ExternalLink } from 'lucide-react'

export function MethodologySection() {
  const cannotList = [
    'Does NOT measure or predict street flood depth in centimeters.',
    'Does NOT model underground stormwater or sanitary sewer pipe surcharge hydraulics.',
    'Does NOT predict building ingress, basement flooding, or structural damage.',
    'Does NOT issue official emergency warnings or evacuation advisories.',
    'Does NOT extrapolate beyond the Amritsar pilot without local calibration.',
  ]

  return (
    <Card className="border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-sm">
      <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-blue-500" />
            <span>Methodology, Assumptions &amp; Scientific Limitations</span>
          </CardTitle>
          <a
            href="/api/evaluation"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            <span>Evaluation Metrics API</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4 text-xs">
        {/* Permanent Mandatory Disclaimer */}
        <div
          role="note"
          className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-950 dark:text-amber-200 text-xs leading-relaxed space-y-1"
        >
          <div className="flex items-center gap-1.5 font-bold uppercase text-[11px] text-amber-800 dark:text-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Research Prototype Notice:</span>
          </div>
          <p>
            Experimental research prototype. Not an official weather forecast or emergency warning. For official alerts see IMD and NDMA SACHET.
          </p>
        </div>

        {/* Modeling Logic */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 space-y-1.5">
            <h5 className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
              1. Multi-Window Rainfall Threat Index (RTI)
            </h5>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
              Urban pluvial flooding is driven by high-intensity convective pulses and antecedent soil saturation. NEXSTORM calculates:
            </p>
            <div className="p-2 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[10px] text-slate-700 dark:text-slate-300 overflow-x-auto">
              RTI = max(P1h/3.5, P3h/8.9, P24h/64.5, (P72h + Antecedent72h)/44.8)
            </div>
            <p className="text-[10px] text-slate-500">
              Calibrated thresholds from 15 monsoon seasons (2010–2024 JJAS reanalysis): T1h=3.5mm, T3h=8.9mm, T24h=64.5mm (IMD Heavy Rain standard), T72h=44.8mm.
            </p>
          </div>

          <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 space-y-1.5">
            <h5 className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
              2. Static Susceptibility Index (s)
            </h5>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
              Cell susceptibility s ∈ [0, 1] is computed from Copernicus DEM GLO-30 terrain and OpenStreetMap building density:
            </p>
            <div className="p-2 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[10px] text-slate-700 dark:text-slate-300 overflow-x-auto">
              s = Σ (w_i × f_i) | depression(0.30), builtUp(0.30), lowPoint(0.15), density(0.15), flatness(0.10)
            </div>
            <p className="text-[10px] text-slate-500">
              Terrain relief variance std=1.75m verifies sufficient terrain topography across Amritsar (override inactive).
            </p>
          </div>
        </div>

        {/* Scientific Validation & Baselines Audit */}
        <div className="p-3.5 rounded-lg border border-blue-200/80 dark:border-blue-900/40 bg-blue-50/30 dark:bg-blue-950/20 space-y-2.5">
          <div className="flex items-center justify-between">
            <h5 className="font-bold text-blue-950 dark:text-blue-200 text-xs">
              3. Scientific Validation &amp; Baseline Performance Audit (N=15 Hotspots, 9 Events)
            </h5>
            <span className="text-[10px] px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 font-mono text-blue-700 dark:text-blue-300">
              configHash: 74f46326
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr className="border-b border-blue-200 dark:border-blue-800/60 text-slate-600 dark:text-slate-400 font-semibold">
                  <th className="py-1 px-1.5">Model / Baseline</th>
                  <th className="py-1 px-1.5 text-center">ROC-AUC</th>
                  <th className="py-1 px-1.5 text-center">Top 20% Hits</th>
                  <th className="py-1 px-1.5">Statistical Assessment &amp; Interpretation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-100 dark:divide-blue-900/30">
                <tr>
                  <td className="py-1 px-1.5 font-medium">Random Baseline</td>
                  <td className="py-1 px-1.5 text-center font-mono">0.5000</td>
                  <td className="py-1 px-1.5 text-center font-mono">20.0%</td>
                  <td className="py-1 px-1.5 text-slate-500">Theoretical spatial null expectation</td>
                </tr>
                <tr>
                  <td className="py-1 px-1.5 font-medium">Depression Only (f_depression)</td>
                  <td className="py-1 px-1.5 text-center font-mono">0.5431</td>
                  <td className="py-1 px-1.5 text-center font-mono">33.3%</td>
                  <td className="py-1 px-1.5 text-slate-500">Pure topographic elevation hollow ranking</td>
                </tr>
                <tr className="bg-blue-100/50 dark:bg-blue-900/30 font-semibold text-blue-950 dark:text-blue-200">
                  <td className="py-1 px-1.5">NEXSTORM Frozen Susceptibility (S)</td>
                  <td className="py-1 px-1.5 text-center font-mono">0.5609</td>
                  <td className="py-1 px-1.5 text-center font-mono">53.3% (8/15)</td>
                  <td className="py-1 px-1.5 text-blue-900 dark:text-blue-300 font-normal">
                    Median hotspot percentile: 81.9%; 95% Clopper-Pearson CI: [26.6%, 78.7%]. 2.67x lift over null.
                  </td>
                </tr>
                <tr>
                  <td className="py-1 px-1.5 font-medium text-amber-900 dark:text-amber-300">
                    Built-Up Density Only (f_builtUp)
                  </td>
                  <td className="py-1 px-1.5 text-center font-mono text-amber-900 dark:text-amber-300">0.8658</td>
                  <td className="py-1 px-1.5 text-center font-mono text-amber-900 dark:text-amber-300">86.7%</td>
                  <td className="py-1 px-1.5 text-amber-800 dark:text-amber-400">
                    <strong>Selection Bias:</strong> News reports heavily focus on dense arterial commercial hubs. High AUC reflects media coverage patterns, NOT true hydrological ground truth.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="p-2.5 rounded bg-blue-100/40 dark:bg-blue-900/20 text-[10px] text-slate-700 dark:text-slate-300 space-y-1">
            <p>
              <strong>Alert Burden &amp; Detection Trade-Off:</strong> Model alert rule (Max RTI ≥ 0.5) captures <strong>66.7% (6/9)</strong> of reported waterlogging events (Wilson 95% CI: [35.4%, 87.9%]), whereas the IMD 24h 64.5mm threshold captures 0.0% (0/9). However, RTI ≥ 0.5 triggers on <strong>45 days per 122-day monsoon season (~37%)</strong>, meaning heightened sensitivity incurs substantial false alarm burden.
            </p>
            <p>
              <strong>Zero Training Leakage:</strong> Heuristic model weights were established a priori and verified against 2023 (60% top-20% hit share) and 2024 (50% top-20% hit share) without retrospective tuning.
            </p>
          </div>
        </div>

        {/* Explicit Boundary of What NEXSTORM CANNOT DO */}
        <div className="p-3 rounded-lg border border-rose-200/80 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/20 space-y-2">
          <div className="font-semibold text-rose-900 dark:text-rose-300 text-xs flex items-center gap-1.5">
            <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>Explicit Scientific Boundaries (What NEXSTORM Does NOT Claim)</span>
          </div>
          <ul className="space-y-1 pl-1">
            {cannotList.map((item, i) => (
              <li key={i} className="text-[11px] text-rose-800 dark:text-rose-300 flex items-start gap-1.5 leading-relaxed">
                <span className="font-bold text-rose-500">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
