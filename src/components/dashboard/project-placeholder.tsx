import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function ProjectPlaceholder() {
  const extensionPoints = [
    {
      title: '1. Domain Data Models',
      description: 'Define schema and tables in Supabase SQL editor or migrations.',
      path: 'src/lib/supabase/',
    },
    {
      title: '2. Product Components',
      description: 'Build your feature UI and interactive panels.',
      path: 'src/components/',
    },
    {
      title: '3. Server Handlers & APIs',
      description: 'Add API routes or Server Actions for AI pipelines and third-party APIs.',
      path: 'src/app/api/ or src/app/actions/',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Active Operational Solutions */}
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
          Active NEXSTORM Intelligence Pillars
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs hover:border-blue-400 transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded">
                  Pillar A
                </span>
                <span className="text-[11px] text-slate-400 font-mono">2,500 Cells</span>
              </div>
              <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-1.5">
                250m City Grid Console
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
                Interactive spatial susceptibility grid for Amritsar with ECMWF-calibrated rainfall vectors and realtime IMD radar overlays.
              </p>
            </div>
            <Link
              href="/city/amritsar"
              className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 py-2 px-3 rounded-lg shadow-xs transition"
            >
              Launch 250m Grid Console &rarr;
            </Link>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs hover:border-amber-400 transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded">
                  Pillar B
                </span>
                <span className="text-[11px] text-slate-400 font-mono">5,200 Footprints</span>
              </div>
              <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-1.5">
                Building Exposure Assessment
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
                Building-level exposure index, surface slope drainage, critical asset classification, and nearest-station telemetry.
              </p>
            </div>
            <Link
              href="/?tab=buildings"
              className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 py-2 px-3 rounded-lg transition"
            >
              Inspect Building Assets &rarr;
            </Link>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs hover:border-emerald-400 transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded">
                  Pillar C
                </span>
                <span className="text-[11px] text-slate-400 font-mono">14,855 Segments</span>
              </div>
              <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-1.5">
                Flood-Aware Routing Engine
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
                Origin-to-destination corridor planner comparing shortest path vs flood-avoidance corridor with elevation profiles.
              </p>
            </div>
            <Link
              href="/?tab=roads"
              className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 py-2 px-3 rounded-lg transition"
            >
              Plan Flood-Aware Route &rarr;
            </Link>
          </div>
        </div>
      </div>

      <Card className="border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            Product Workspace Extension Point
          </CardTitle>
          <CardDescription className="text-xs">
            This protected shell verifies authentication, sessions, and responsive navigation.
            When implementing your hackathon challenge, replace this placeholder with your actual product experience.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {extensionPoints.map((item) => (
              <div
                key={item.title}
                className="rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3"
              >
                <h4 className="text-xs font-semibold mb-1">{item.title}</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2 leading-relaxed">
                  {item.description}
                </p>
                <div className="text-[10px] font-mono text-slate-400 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded inline-block">
                  {item.path}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
