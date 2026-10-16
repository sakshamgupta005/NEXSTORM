'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import {
  ExternalLink,
  ShieldCheck,
  MapPin,
  School,
  Activity,
  ArrowRight,
  Droplets,
  Layers,
  Compass,
  FileCheck,
  Building2,
  ChevronRight,
  Sparkles,
} from 'lucide-react'
import { FrontendNavbar } from '@/components/home/FrontendNavbar'
import { Footer } from '@/components/layout/footer'
import { HealthDiagnosticsModal } from '@/components/home/HealthDiagnosticsModal'
import { ObservationReportModal } from '@/components/observations/ObservationReportModal'

export function GnduCampaignView() {
  const [isHealthModalOpen, setIsHealthModalOpen] = useState(false)
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)

  return (
    <div className="min-h-screen flex flex-col bg-[#f5f5f7] text-[#0f172a] font-sans antialiased selection:bg-blue-600 selection:text-white">
      {/* High-Precision Header Navigation identical to the rest of NEXSTORM */}
      <FrontendNavbar
        onOpenStatusModal={() => setIsHealthModalOpen(true)}
        onOpenReportModal={() => setIsReportModalOpen(true)}
      />

      {/* Main Campaign Content Wrapper */}
      <main className="flex-1 w-full">
        {/* Breadcrumb Bar */}
        <section className="w-full border-b border-slate-200/90 bg-white/90 backdrop-blur-md sticky top-16 z-30">
          <div className="max-w-[1360px] mx-auto px-4 sm:px-8 py-3.5 flex items-center justify-between text-xs">
            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-slate-500 font-medium">
              <Link href="/" className="hover:text-blue-700 transition-colors">
                NEXSTORM Home
              </Link>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <Link href="/?tab=buildings" className="hover:text-blue-700 transition-colors">
                Buildings &amp; Infrastructure
              </Link>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-900 font-semibold truncate">
                GNDU Campus Campaign 2026
              </span>
            </nav>

            <div className="hidden sm:flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-mono font-bold border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                CAMPAIGN ACTIVE
              </span>
              <span className="text-[11px] font-mono text-slate-500">ID: ASR-GNDU-2026</span>
            </div>
          </div>
        </section>

        {/* Hero Section with Clean Radial Gradient */}
        <section
          className="relative w-full border-b border-slate-200/80 bg-white"
          style={{
            background:
              'radial-gradient(circle at 50% -20%, rgba(219, 234, 254, 0.7) 0%, rgba(241, 245, 249, 0.4) 45%, #ffffff 85%)',
          }}
        >
          <div className="max-w-[1360px] mx-auto px-4 sm:px-8 pt-12 sm:pt-16 pb-16 sm:pb-20 flex flex-col items-center text-center">
            {/* Pill Badge */}
            <div className="inline-flex items-center gap-2.5 px-4 sm:px-5 py-2 mb-6 bg-white border border-slate-200/90 rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <School className="w-4 h-4 text-blue-700" />
              <span className="text-xs sm:text-sm font-bold tracking-tight text-slate-800 font-sans">
                GURU NANAK DEV UNIVERSITY, AMRITSAR • 50M MICRO-GRID PILOT
              </span>
            </div>

            {/* Main Headline */}
            <h1
              className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 max-w-4xl leading-[1.12]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Student-Led Campus <br className="hidden sm:inline" />
              <span className="text-blue-700">Flood Resilience</span> Campaign 2026
            </h1>

            {/* Highly Readable Subtitle */}
            <p className="mt-6 text-base sm:text-xl text-slate-600 max-w-3xl leading-relaxed font-sans font-normal">
              Equipping 24,000+ university scholars, faculty, and campus administrators with
              deterministic 50m micro-topography modeling, real-time plinth exposure analytics, and
              hyper-local drainage safety routing across 699 verified campus cells.
            </p>

            {/* Action Buttons with Robust Inline Styles for Perfect Layout */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/city/amritsar"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '14px 28px',
                  borderRadius: '12px',
                  backgroundColor: '#1d4ed8',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '14px',
                  textDecoration: 'none',
                  boxShadow: '0 4px 14px rgba(29, 78, 216, 0.3)',
                  transition: 'all 0.18s ease',
                  letterSpacing: '0.01em',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#1e40af'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(29, 78, 216, 0.4)'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = '#1d4ed8'
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 4px 14px rgba(29, 78, 216, 0.3)'
                }}
              >
                <span>Launch 50m Campus Grid Console</span>
                <ExternalLink style={{ width: '16px', height: '16px' }} />
              </Link>

              <Link
                href="/?tab=buildings"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '14px 26px',
                  borderRadius: '12px',
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                  border: '1.5px solid #cbd5e1',
                  fontWeight: 700,
                  fontSize: '14px',
                  textDecoration: 'none',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                  transition: 'all 0.18s ease',
                  letterSpacing: '0.01em',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8fafc'
                  e.currentTarget.style.borderColor = '#94a3b8'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = '#ffffff'
                  e.currentTarget.style.borderColor = '#cbd5e1'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                <Building2 style={{ width: '16px', height: '16px', color: '#1d4ed8' }} />
                <span>Inspect Science Block Footprint</span>
              </Link>

              <button
                type="button"
                onClick={() => setIsReportModalOpen(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '14px 26px',
                  borderRadius: '12px',
                  backgroundColor: '#0f172a',
                  color: '#ffffff',
                  border: '1px solid #1e293b',
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 10px rgba(15, 23, 42, 0.18)',
                  transition: 'all 0.18s ease',
                  letterSpacing: '0.01em',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#1e293b'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 6px 18px rgba(15, 23, 42, 0.28)'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = '#0f172a'
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 2px 10px rgba(15, 23, 42, 0.18)'
                }}
              >
                <Droplets style={{ width: '16px', height: '16px', color: '#22d3ee' }} />
                <span>Submit Field Report</span>
              </button>
            </div>
          </div>
        </section>

        {/* Content Container */}
        <div className="max-w-[1360px] mx-auto px-4 sm:px-8 py-14 sm:py-20 space-y-16 sm:space-y-20">
          {/* Key Metrics Grid (4 Pillars) */}
          <section aria-label="Key Campaign Metrics" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2">
              <div>
                <span className="text-xs font-mono font-bold tracking-widest text-blue-700 uppercase">
                  MICRO-TOPOGRAPHIC BENCHMARK
                </span>
                <h2
                  className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mt-1"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  High-Precision Campus Micro-Grid by the Numbers
                </h2>
              </div>
              <p className="text-sm text-slate-500 max-w-md leading-relaxed">
                Continuous Copernicus DEM 30m surface resampled to 50m micro-cells to resolve localized
                pooling at building plinths.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Card 1 */}
              <div className="neuro-card p-7 sm:p-8 flex flex-col justify-between space-y-5 border border-slate-200/90 bg-white">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-[11px] font-mono font-bold border border-blue-200">
                    50M RESOLUTION
                  </span>
                  <Layers className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <div
                    className="text-4xl sm:text-5xl font-black text-blue-700 tracking-tight"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    699
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-2">Micro-Grid Cells</h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mt-1.5">
                    High-resolution 50m x 50m cells mapping every department foundation, courtyard,
                    and transit corridor across the campus.
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-100 text-[11px] font-mono text-slate-500">
                  Data: campus_susceptibility.geojson
                </div>
              </div>

              {/* Card 2 */}
              <div className="neuro-card p-7 sm:p-8 flex flex-col justify-between space-y-5 border border-slate-200/90 bg-white">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 text-[11px] font-mono font-bold border border-emerald-200">
                    STRUCTURES COVERED
                  </span>
                  <Building2 className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <div
                    className="text-4xl sm:text-5xl font-black text-emerald-700 tracking-tight"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    42
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-2">Campus Facilities Mapped</h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mt-1.5">
                    Individual footprints for Science Enclaves, Guru Nanak Bhawan, University
                    Library, Student Hostels, and Botanical Enclosures.
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-100 text-[11px] font-mono text-slate-500">
                  Google Open Buildings V3 Spatial Join
                </div>
              </div>

              {/* Card 3 */}
              <div className="neuro-card p-7 sm:p-8 flex flex-col justify-between space-y-5 border border-slate-200/90 bg-white">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 text-[11px] font-mono font-bold border border-indigo-200">
                    TOPOGRAPHIC PEAK
                  </span>
                  <Compass className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <div
                    className="text-4xl sm:text-5xl font-black text-indigo-700 tracking-tight"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    233.8m
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-2">Ridge Crest Elevation</h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mt-1.5">
                    Natural +1.8% positive gradient shedding sheetflow away from core lecture halls
                    toward perimeter eco-swales and green sinks.
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-100 text-[11px] font-mono text-slate-500">
                  Copernicus DEM (WGS84 Reference)
                </div>
              </div>

              {/* Card 4 */}
              <div className="neuro-card p-7 sm:p-8 flex flex-col justify-between space-y-5 border border-slate-200/90 bg-white">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 text-[11px] font-mono font-bold border border-purple-200">
                    FIELD VERIFIED
                  </span>
                  <FileCheck className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <div
                    className="text-4xl sm:text-5xl font-black text-purple-700 tracking-tight"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    100%
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-2">Ground-Truth Calibrated</h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mt-1.5">
                    Field-checked against historical monsoon rain records and student geotags along
                    the Grand Trunk (GT) Road corridor.
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-100 text-[11px] font-mono text-slate-500">
                  Audited Citizen Science Observation Log
                </div>
              </div>
            </div>
          </section>

          {/* Campus Spotlight Feature Card (2 Columns: High-Res Visual + Technical Detail) */}
          <section
            aria-label="Campus Spotlight"
            className="neuro-card p-8 sm:p-12 border border-slate-200/90 bg-white shadow-[0_4px_24px_rgba(0,0,0,0.04)]"
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
              {/* Left Column: Visual with Live Telemetry Chips */}
              <div className="lg:col-span-6 relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-950 shadow-md group">
                <img
                  src="/assets/locations/gndu-science.jpg"
                  alt="Guru Nanak Dev University Science Block"
                  className="w-full h-80 sm:h-[420px] object-cover object-center group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-900/30 to-transparent pointer-events-none" />

                {/* Floating Telemetry Chips */}
                <div className="absolute top-4 left-4 flex flex-wrap gap-2">
                  <span className="px-3 py-1.5 rounded-full bg-slate-900/90 backdrop-blur-md text-white text-xs font-mono font-semibold border border-white/20 shadow-xs">
                    📍 31.638° N, 74.825° E
                  </span>
                  <span className="px-3 py-1.5 rounded-full bg-blue-600/90 backdrop-blur-md text-white text-xs font-semibold shadow-xs">
                    Campus Landmark
                  </span>
                </div>

                <div className="absolute bottom-4 left-4 right-4 p-4 rounded-xl bg-slate-900/90 backdrop-blur-md border border-white/10 text-white">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h4
                        className="font-bold text-sm tracking-tight"
                        style={{ fontFamily: 'var(--font-display)' }}
                      >
                        GNDU Science Enclave &amp; Laboratories
                      </h4>
                      <p className="text-[11px] text-slate-300 font-mono mt-0.5">
                        Elevation: 233.8m MSL • Drainage Slope: +1.8% (Positive)
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-300 text-xs font-mono font-bold border border-emerald-500/30 shrink-0">
                      LOW RISK
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: Mission and Operational Brief */}
              <div className="lg:col-span-6 space-y-6">
                <div>
                  <span className="text-xs font-mono font-bold tracking-widest text-blue-700 uppercase">
                    CIVIC RESILIENCE FRAMEWORK
                  </span>
                  <h2
                    className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mt-1 leading-tight"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    Micro-Catchment Intelligence for 500+ Acres
                  </h2>
                  <p className="text-sm sm:text-base text-slate-600 leading-relaxed mt-3">
                    Macro-scale city assessments average elevations over 250m grid cells, which often
                    masks hyper-local water accumulation around campus foundations, lecture halls, and
                    pedestrian underpasses. The GNDU Campaign utilizes 50m cell granularity to give campus
                    facility managers and students actionable clarity before rain starts.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-4">
                    <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 shrink-0 mt-0.5">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Deterministic Plinth Modeling</h4>
                      <p className="text-xs text-slate-600 leading-relaxed mt-1">
                        Elevation contours isolate building basements and entry plinths against local curb
                        sinks, preventing laboratory equipment and library archive water damage.
                      </p>
                    </div>
                  </div>

                  <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-4">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-800 shrink-0 mt-0.5">
                      <Activity className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Municipal Conduit Surcharge Sync</h4>
                      <p className="text-xs text-slate-600 leading-relaxed mt-1">
                        Monitors downstream flow into Municipal Corporation of Amritsar (MCA) GT Road
                        storm drains, issuing early warning 45 minutes prior to gate chokepoints.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3.5 pt-2">
                  <Link
                    href="/city/amritsar"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '12px 22px',
                      borderRadius: '12px',
                      backgroundColor: '#1d4ed8',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '13px',
                      textDecoration: 'none',
                      boxShadow: '0 2px 8px rgba(29, 78, 216, 0.25)',
                      transition: 'all 0.18s ease',
                    }}
                  >
                    <span>Inspect 50m Campus Heatmap</span>
                    <ArrowRight style={{ width: '15px', height: '15px' }} />
                  </Link>

                  <button
                    type="button"
                    onClick={() => setIsReportModalOpen(true)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '12px 22px',
                      borderRadius: '12px',
                      backgroundColor: '#ffffff',
                      color: '#334155',
                      border: '1px solid #cbd5e1',
                      fontWeight: 600,
                      fontSize: '13px',
                      cursor: 'pointer',
                      transition: 'all 0.18s ease',
                    }}
                  >
                    <Droplets style={{ width: '15px', height: '15px', color: '#1d4ed8' }} />
                    <span>Submit Geotagged Report</span>
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Detailed Campus Facilities Exposure Dossier */}
          <section aria-label="Campus Key Facilities Exposure" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2">
              <div>
                <span className="text-xs font-mono font-bold tracking-widest text-blue-700 uppercase">
                  MONITORED INFRASTRUCTURE DOSSIER
                </span>
                <h2
                  className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mt-1"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Campus Zones &amp; Hydraulic Risk Analysis
                </h2>
              </div>
              <p className="text-sm text-slate-500 max-w-md leading-relaxed">
                Verified elevation and drainage characteristics for core academic, residential, and
                transportation nodes.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Zone 1 */}
              <div className="neuro-card p-6 sm:p-7 border border-slate-200/90 bg-white flex flex-col justify-between space-y-4">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      SAFE ELEVATION
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-500">ZONE-01</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900">University Science Block</h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    Elevated upon the natural 233.8m crest. Surface stormwater rapidly sheds away from
                    lecture halls toward perimeter swales.
                  </p>
                </div>

                <div className="space-y-2.5 pt-4 border-t border-slate-100 text-xs">
                  <div className="flex justify-between text-slate-500">
                    <span>Base Elevation:</span>
                    <span className="font-mono font-bold text-slate-800">233.8m MSL</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Terrain Slope:</span>
                    <span className="font-mono font-bold text-emerald-700">+1.8% Gradient</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Plinth Clearance:</span>
                    <span className="font-mono font-bold text-slate-800">+0.8m Above Tarmac</span>
                  </div>
                </div>
              </div>

              {/* Zone 2 */}
              <div className="neuro-card p-6 sm:p-7 border border-slate-200/90 bg-white flex flex-col justify-between space-y-4">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded text-[10px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200">
                      ATTENTION ZONE
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-500">ZONE-02</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900">Main Entrance &amp; GT Road Gate</h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    Low-lying perimeter gateway. Subject to backflow from municipal GT Road storm drains
                    during cloudburst events exceeding 35 mm/hr.
                  </p>
                </div>

                <div className="space-y-2.5 pt-4 border-t border-slate-100 text-xs">
                  <div className="flex justify-between text-slate-500">
                    <span>Base Elevation:</span>
                    <span className="font-mono font-bold text-slate-800">229.4m MSL</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Terrain Slope:</span>
                    <span className="font-mono font-bold text-amber-700">-0.6% Depression</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Lead Warning:</span>
                    <span className="font-mono font-bold text-slate-800">45 Minutes Lead Time</span>
                  </div>
                </div>
              </div>

              {/* Zone 3 */}
              <div className="neuro-card p-6 sm:p-7 border border-slate-200/90 bg-white flex flex-col justify-between space-y-4">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      SECURED PLINTH
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-500">ZONE-03</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900">Guru Nanak Bhawan &amp; Library</h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    Engineered stepped podium foundation with perimeter French drains. Zero structural
                    ingress during historical 2024 monsoon cloudbursts.
                  </p>
                </div>

                <div className="space-y-2.5 pt-4 border-t border-slate-100 text-xs">
                  <div className="flex justify-between text-slate-500">
                    <span>Base Elevation:</span>
                    <span className="font-mono font-bold text-slate-800">232.1m MSL</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Terrain Slope:</span>
                    <span className="font-mono font-bold text-emerald-700">+1.1% Positive</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Internal Drainage:</span>
                    <span className="font-mono font-bold text-slate-800">Gravity Outfall</span>
                  </div>
                </div>
              </div>

              {/* Zone 4 */}
              <div className="neuro-card p-6 sm:p-7 border border-slate-200/90 bg-white flex flex-col justify-between space-y-4">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded text-[10px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      DETENTION BASIN
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-500">ZONE-04</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900">Sports Grounds &amp; Botanical Turf</h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    Functions as a designed unpaved flood retention sponge, recharging groundwater while
                    shielding adjacent student residential hostels.
                  </p>
                </div>

                <div className="space-y-2.5 pt-4 border-t border-slate-100 text-xs">
                  <div className="flex justify-between text-slate-500">
                    <span>Base Elevation:</span>
                    <span className="font-mono font-bold text-slate-800">228.6m MSL</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Soil Permeability:</span>
                    <span className="font-mono font-bold text-blue-700">High Infiltration</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Buffer Capacity:</span>
                    <span className="font-mono font-bold text-slate-800">12,500 m³ Retention</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Scientific Methodology: 4-Stage Pipeline */}
          <section
            aria-label="Scientific Methodology"
            className="neuro-card p-8 sm:p-12 border border-slate-200/90 bg-white shadow-sm space-y-8"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 shadow-xs">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-mono font-bold tracking-widest text-blue-700 uppercase">
                  SCIENTIFIC RIGOR
                </span>
                <h2
                  className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Campaign Engineering &amp; Data Pipeline
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Step 1 */}
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-8 h-8 rounded-xl bg-blue-700 text-white font-mono font-bold text-xs flex items-center justify-center shadow-xs">
                    01
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">COP-DEM</span>
                </div>
                <h4 className="font-bold text-sm text-slate-900">50m Micro-Cell Resampling</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Copernicus 30m Digital Elevation Model tiles are bilinearly resampled into a 50m
                  conformal grid for the university bounds, preserving drainage breaks.
                </p>
              </div>

              {/* Step 2 */}
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-8 h-8 rounded-xl bg-indigo-700 text-white font-mono font-bold text-xs flex items-center justify-center shadow-xs">
                    02
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">FILL-SPILL</span>
                </div>
                <h4 className="font-bold text-sm text-slate-900">Hydrological Sink Extraction</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Topographic sink algorithms calculate depression depth, pour-point elevations, and
                  surface water accumulation volume for every campus courtyard.
                </p>
              </div>

              {/* Step 3 */}
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-8 h-8 rounded-xl bg-emerald-700 text-white font-mono font-bold text-xs flex items-center justify-center shadow-xs">
                    03
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">MCA-API</span>
                </div>
                <h4 className="font-bold text-sm text-slate-900">Stormwater Surcharge Sync</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Runoff calculations are cross-calibrated against Amritsar Municipal Corporation GT
                  Road conduit capacity to calculate surcharge warning thresholds.
                </p>
              </div>

              {/* Step 4 */}
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-8 h-8 rounded-xl bg-purple-700 text-white font-mono font-bold text-xs flex items-center justify-center shadow-xs">
                    04
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">CROWD-TRUTH</span>
                </div>
                <h4 className="font-bold text-sm text-slate-900">Student Ground-Truth Audits</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Scholars submit geotagged curb depth observations directly via the platform,
                  calibrating remote sensing models with real physical observations.
                </p>
              </div>
            </div>
          </section>

          {/* Interactive Callout Banner (Action Trigger) */}
          <section className="rounded-3xl p-8 sm:p-14 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white shadow-xl relative overflow-hidden">
            <div className="relative z-10 max-w-3xl space-y-5">
              <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-mono font-bold border border-blue-400/30">
                ACTIVE RESEARCH PARTICIPATION
              </span>
              <h2
                className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-tight"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Explore the Interactive 50m Micro-Grid Console
              </h2>
              <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
                Toggle between the 250m macro Amritsar metropolitan overview and the 50m GNDU Campus
                micro-grid. Inspect individual cell hazard scores, flow paths, and structural plinths in
                real time.
              </p>
              <div className="pt-4 flex flex-wrap gap-4">
                <Link
                  href="/city/amritsar"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '14px 28px',
                    borderRadius: '12px',
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '14px',
                    textDecoration: 'none',
                    boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
                    transition: 'all 0.18s ease',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = '#1d4ed8'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = '#2563eb'
                    e.currentTarget.style.transform = 'translateY(0)'
                  }}
                >
                  <span>Launch 50m Campus Console</span>
                  <ExternalLink style={{ width: '16px', height: '16px' }} />
                </Link>

                <Link
                  href="/?tab=buildings"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '14px 28px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(255, 255, 255, 0.12)',
                    color: '#ffffff',
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                    fontWeight: 700,
                    fontSize: '14px',
                    textDecoration: 'none',
                    transition: 'all 0.18s ease',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)'
                    e.currentTarget.style.transform = 'translateY(0)'
                  }}
                >
                  <span>View Building Dossier</span>
                  <ArrowRight style={{ width: '16px', height: '16px' }} />
                </Link>
              </div>
            </div>

            {/* Subtle Decorative Backdrop Elements */}
            <div className="absolute -right-12 -bottom-12 w-96 h-96 rounded-full bg-blue-600/15 blur-3xl pointer-events-none" />
          </section>

          {/* Technical Provenance & Data Specifications */}
          <section className="p-7 sm:p-10 rounded-2xl bg-white border border-slate-200/90 text-xs text-slate-500 space-y-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-100">
              <div className="flex items-center gap-2 font-mono font-bold text-slate-700">
                <MapPin className="w-4 h-4 text-blue-600" />
                <span>CAMPAIGN GEOSPATIAL PROVENANCE</span>
              </div>
              <div className="font-mono text-slate-400">
                WGS84 • EPSG:4326 • Elevation Datum: EGM2008
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 leading-relaxed">
              <div>
                <span className="font-bold text-slate-800 text-xs block mb-1">Sponsor &amp; Coordination</span>
                GNDU Department of Urban Planning &amp; Campus Administration
              </div>
              <div>
                <span className="font-bold text-slate-800 text-xs block mb-1">Municipal Integration</span>
                Amritsar Municipal Corporation (MCA) Stormwater Network
              </div>
              <div>
                <span className="font-bold text-slate-800 text-xs block mb-1">Primary Terrain Source</span>
                Copernicus GLO-30 Digital Elevation Model (European Space Agency)
              </div>
              <div>
                <span className="font-bold text-slate-800 text-xs block mb-1">Incident Baseline</span>
                BuildFest 2.0 PS-18 Amritsar Pilot Incident Log (2024–2026)
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Global NEXSTORM Footer */}
      <Footer />

      {/* Live System Diagnostics Modal */}
      <HealthDiagnosticsModal
        isOpen={isHealthModalOpen}
        onClose={() => setIsHealthModalOpen(false)}
      />

      {/* Observation Report Modal */}
      <ObservationReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        cityId="amritsar"
      />
    </div>
  )
}
