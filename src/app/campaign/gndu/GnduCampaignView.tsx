'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import {
  Camera,
  MapPin,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Droplets,
  AlertCircle,
} from 'lucide-react'
import { FrontendNavbar } from '@/components/home/FrontendNavbar'
import { Footer } from '@/components/layout/footer'
import { HealthDiagnosticsModal } from '@/components/home/HealthDiagnosticsModal'
import { ObservationReportModal } from '@/components/observations/ObservationReportModal'

const GNDU_COORDINATES = { lat: 31.6375, lng: 74.8252 }

const FOCUS_AREAS = [
  'GT Road Main Entrance & Gate',
  'Science Block & Laboratory Pathways',
  'Guru Nanak Bhawan & Library Courtyard',
  'Student Hostels Access Roads',
  'Sports Grounds & Outer Perimeter',
]

export function GnduCampaignView() {
  const [isHealthModalOpen, setIsHealthModalOpen] = useState(false)
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] text-slate-900 font-sans antialiased selection:bg-blue-600 selection:text-white">
      <FrontendNavbar
        onOpenStatusModal={() => setIsHealthModalOpen(true)}
        onOpenReportModal={() => setIsReportModalOpen(true)}
      />

      <main className="flex-1 w-full">
        {/* Breadcrumb Bar */}
        <section className="w-full border-b border-slate-200 bg-white/90 backdrop-blur-md sticky top-16 z-20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between text-xs">
            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-slate-500 font-medium">
              <Link href="/" className="hover:text-blue-700 transition-colors">
                NEXSTORM Home
              </Link>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-900 font-semibold truncate">
                GNDU Campus Campaign
              </span>
            </nav>

            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-mono font-semibold border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
              STUDENT INITIATIVE
            </span>
          </div>
        </section>

        {/* Hero Section */}
        <section className="relative w-full border-b border-slate-200 bg-white py-12 sm:py-16">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 mb-5 bg-blue-50 border border-blue-200 rounded-full text-blue-700 text-xs font-semibold">
              <Droplets className="w-3.5 h-3.5" />
              <span>Guru Nanak Dev University (GNDU) • Campus Waterlogging Drive</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
              Help Map Waterlogged Spots Across GNDU Campus
            </h1>

            <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto">
              Notice spots on campus that flood or collect water during rain? Snap a photo and upload it.
              Your submissions help build an accurate campus flood map so students, staff, and campus
              teams know which pathways stay safe and clear.
            </p>

            {/* Main Action Buttons */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
              <button
                type="button"
                onClick={() => setIsReportModalOpen(true)}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all transform active:scale-95 cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>Upload Campus Photo &amp; Report Spot</span>
              </button>

              <Link
                href="/city/amritsar"
                className="inline-flex items-center gap-2 px-5 py-3.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-semibold text-sm shadow-xs transition-colors"
              >
                <span>View Live Campus Map</span>
                <ExternalLink className="w-4 h-4 text-slate-500" />
              </Link>
            </div>
          </div>
        </section>

        {/* 3 Simple Steps */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
          <h2 className="text-center text-xs font-mono font-bold tracking-widest text-blue-700 uppercase mb-2">
            HOW TO CONTRIBUTE
          </h2>
          <p className="text-center text-xl font-bold text-slate-900 mb-8">
            Three Quick Steps to Protect Our Campus
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 font-bold flex items-center justify-center text-sm font-mono border border-blue-200">
                1
              </div>
              <h3 className="font-bold text-slate-900 text-base">Spot an Area</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Find puddles, flooded walkways, choked drains, or low ground around departments and hostels.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 font-bold flex items-center justify-center text-sm font-mono border border-blue-200">
                2
              </div>
              <h3 className="font-bold text-slate-900 text-base">Take a Photo</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Snap a clear photo showing the water level, road curb, or surrounding campus landmark.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 font-bold flex items-center justify-center text-sm font-mono border border-blue-200">
                3
              </div>
              <h3 className="font-bold text-slate-900 text-base">Upload with Location</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Hit upload, add a brief note or severity level, and submit. The spot gets mapped instantly.
              </p>
            </div>
          </div>

          {/* Quick Focus Areas Chips */}
          <div className="mt-10 p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-4 h-4 text-blue-700" />
              <h4 className="font-bold text-sm text-slate-900">Key Campus Areas We Need Reports From</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {FOCUS_AREAS.map((area) => (
                <span
                  key={area}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200/80"
                >
                  {area}
                </span>
              ))}
            </div>
          </div>

          {/* Direct CTA Box */}
          <div className="mt-8 p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-blue-900 to-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-5 shadow-sm">
            <div className="space-y-1 text-center sm:text-left">
              <h3 className="text-lg font-bold">Have a photo ready?</h3>
              <p className="text-sm text-slate-300">
                Submit it in under 30 seconds — no sign-up or login required.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsReportModalOpen(true)}
              className="px-5 py-3 rounded-xl bg-white text-slate-900 hover:bg-slate-100 font-bold text-sm shrink-0 transition-colors shadow-xs cursor-pointer flex items-center gap-2"
            >
              <Camera className="w-4 h-4 text-blue-600" />
              <span>Submit Photo Now</span>
            </button>
          </div>
        </section>
      </main>

      <Footer />

      <HealthDiagnosticsModal
        isOpen={isHealthModalOpen}
        onClose={() => setIsHealthModalOpen(false)}
      />

      <ObservationReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        cityId="amritsar"
        initialCoordinates={GNDU_COORDINATES}
      />
    </div>
  )
}
