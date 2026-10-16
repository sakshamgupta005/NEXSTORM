'use client'

import React, { useState } from 'react'
import { FrontendNavbar, type TabKey } from './FrontendNavbar'
import { OverviewSection } from './OverviewSection'
import { BuildingsSection } from './BuildingsSection'
import { RoadsSection } from './RoadsSection'
import { AboutSection } from './AboutSection'
import { HealthDiagnosticsModal } from './HealthDiagnosticsModal'
import { ObservationReportModal } from '@/components/observations/ObservationReportModal'

export function FrontendApp() {
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const tabParam = params.get('tab') as TabKey | null
      if (tabParam && ['overview', 'buildings', 'roads', 'about'].includes(tabParam)) {
        return tabParam
      }
    }
    return 'overview'
  })
  const [isHealthModalOpen, setIsHealthModalOpen] = useState<boolean>(false)
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false)
  const [showGnduBanner, setShowGnduBanner] = useState<boolean>(true)

  React.useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search)
      const tabParam = params.get('tab') as TabKey | null
      if (tabParam && ['overview', 'buildings', 'roads', 'about'].includes(tabParam)) {
        setActiveTab(tabParam)
      } else {
        setActiveTab('overview')
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const handleSwitchTab = (tab: TabKey) => {
    setActiveTab(tab)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      if (tab === 'overview') {
        url.searchParams.delete('tab')
      } else {
        url.searchParams.set('tab', tab)
      }
      window.history.replaceState({}, '', url.toString())
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f5f5f7] text-[#090e17]">
      {/* Dynamic GNDU Campaign Announcement Banner */}
      {showGnduBanner && (
        <div className="bg-gradient-to-r from-blue-950 via-indigo-900 to-slate-900 text-white px-4 py-2 text-xs font-medium flex items-center justify-between border-b border-blue-800/40 relative z-30">
          <div className="flex items-center gap-2 mx-auto truncate">
            <span className="text-sm select-none">🎓</span>
            <span className="font-semibold text-blue-200">GNDU Campus Campaign 2026:</span>
            <span className="text-slate-300 hidden md:inline">
              Help map flood-prone spots across campus by sharing your photos and ground observations.
            </span>
            <a
              href="/campaign/gndu"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white underline underline-offset-2 hover:text-blue-200 font-bold ml-1 inline-flex items-center gap-0.5"
            >
              Learn More ↗
            </a>
          </div>
          <button
            onClick={() => setShowGnduBanner(false)}
            className="text-slate-400 hover:text-white p-1 text-xs shrink-0 cursor-pointer"
            aria-label="Dismiss banner"
          >
            ✕
          </button>
        </div>
      )}

      {/* High-Precision Header Navigation */}
      <FrontendNavbar
        activeTab={activeTab}
        onSelectTab={handleSwitchTab}
        onOpenStatusModal={() => setIsHealthModalOpen(true)}
        onOpenReportModal={() => setIsReportModalOpen(true)}
      />

      {/* Main Tab Content */}
      <div className="flex-1">
        {activeTab === 'overview' && <OverviewSection onSwitchTab={handleSwitchTab} />}
        {activeTab === 'buildings' && <BuildingsSection />}
        {activeTab === 'roads' && <RoadsSection />}
        {activeTab === 'about' && <AboutSection onSwitchTab={handleSwitchTab} />}
      </div>

      {/* Live System & Data Pipeline Diagnostics Modal */}
      <HealthDiagnosticsModal
        isOpen={isHealthModalOpen}
        onClose={() => setIsHealthModalOpen(false)}
      />

      {/* Citizen Waterlogging Report Modal */}
      <ObservationReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        cityId="amritsar"
      />
    </div>
  )
}
