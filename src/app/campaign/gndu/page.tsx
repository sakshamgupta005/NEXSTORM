import React from 'react'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, ShieldCheck, MapPin, School, Activity } from 'lucide-react'

export const metadata = {
  title: 'GNDU Campus Flood Resilience Campaign 2026 — NEXSTORM',
  description:
    'Guru Nanak Dev University (GNDU) hyper-local 50m micro-grid flood intelligence campaign across 699 cells and student crowd-sourced observations.',
}

export default function GnduCampaignPage() {
  return (
    <div className="min-h-screen bg-[#f5f5f7] text-slate-900 font-sans">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link
            href="/?tab=buildings"
            className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-blue-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to NEXSTORM</span>
          </Link>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-mono font-bold border border-blue-200">
              CAMPUS CAMPAIGN 2026
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
        </div>
      </header>

      {/* Hero Header */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-10">
        <div className="relative rounded-3xl overflow-hidden bg-slate-900 border border-slate-800 shadow-xl text-white p-8 sm:p-12">
          <div className="absolute inset-0 opacity-30">
            <img
              src="/assets/locations/gndu-science.jpg"
              alt="GNDU University Campus"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900/90 to-transparent"></div>

          <div className="relative z-10 max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-mono font-bold border border-blue-400/30">
              <School className="w-3.5 h-3.5" />
              GURU NANAK DEV UNIVERSITY, AMRITSAR
            </div>
            <h1 className="text-3xl sm:text-5xl font-black font-['Outfit'] tracking-tight leading-tight">
              Student-Led Campus Flood Resilience Campaign
            </h1>
            <p className="text-base sm:text-lg text-slate-300 font-light leading-relaxed">
              Equipping 24,000+ university scholars, faculty, and campus administrators with
              deterministic 50m micro-topography modeling, real-time plinth exposure analytics, and
              hyper-local drainage safety routing.
            </p>

            <div className="pt-4 flex flex-wrap gap-3">
              <Link
                href="/city/amritsar"
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm flex items-center gap-2 shadow-md transition-all"
              >
                <span>Launch 50m Campus Grid Console</span>
                <ExternalLink className="w-4 h-4" />
              </Link>
              <Link
                href="/?tab=buildings"
                className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm transition-all border border-white/20"
              >
                Inspect Science Block Footprint
              </Link>
            </div>
          </div>
        </div>

        {/* 4 Pillars of GNDU Campaign Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-5">
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
            <span className="text-3xl font-black text-blue-600 font-['Outfit']">699</span>
            <h3 className="text-sm font-bold text-slate-900">High-Res Micro-Cells</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              50m x 50m Copernicus-derived elevation contours mapping every department foundation and courtyard across 699 cells.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
            <span className="text-3xl font-black text-emerald-600 font-['Outfit']">42</span>
            <h3 className="text-sm font-bold text-slate-900">Campus Facilities Mapped</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              University Library, Guru Nanak Bhawan, Science Enclaves, Hostels, and Botanical Gardens.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
            <span className="text-3xl font-black text-indigo-600 font-['Outfit']">233.8m</span>
            <h3 className="text-sm font-bold text-slate-900">Ridge Crest Elevation</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Natural +1.8% positive gradient shedding sheetflow away from core lecture halls toward perimeter green swales.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
            <span className="text-3xl font-black text-purple-600 font-['Outfit']">100%</span>
            <h3 className="text-sm font-bold text-slate-900">Student Ground-Truth</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Crowd-sourced mobile geotagging verifying actual curb-height water levels across monsoon cloudbursts.
            </p>
          </div>
        </div>

        {/* Campaign Action & Provenance */}
        <div className="p-8 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-emerald-600" />
            <h2 className="text-xl font-bold text-slate-900 font-['Outfit']">
              Campaign Objectives &amp; Scientific Methodology
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-slate-600 leading-relaxed">
            <div className="space-y-3">
              <h4 className="font-bold text-slate-900 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-600" />
                Deterministic Campus Micro-Catchment Analysis
              </h4>
              <p>
                Unlike macro city models that average elevation over 250m squares, the GNDU Campaign
                deploys sub-50m cell granularity across 699 verified campus cells (`campus_susceptibility.geojson`).
                This pinpoints localized ponding around the Physics auditorium, Sports complex turf, and administrative parking lots before rainfall peaks.
              </p>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-slate-900 flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-600" />
                Live Early-Warning Integration with MCA
              </h4>
              <p>
                Runoff trajectories connect directly with Municipal Corporation of Amritsar (MCA)
                GT Road stormwater discharge conduits, warning students and maintenance crews 45
                minutes prior to localized campus gateway inundation.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
            <span className="text-xs font-mono text-slate-500">
              Campaign ID: ASR-GNDU-2026 • Verified 699 cells • Co-developed with MCA &amp; Department of Urban Planning
            </span>
            <Link
              href="/?tab=buildings"
              className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <span>Return to Geospatial Map</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
