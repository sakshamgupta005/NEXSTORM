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
      const hashParam = window.location.hash.replace('#', '') as TabKey
      if (hashParam && ['overview', 'buildings', 'roads', 'about'].includes(hashParam)) {
        return hashParam
      }
    }
    return 'overview'
  })
  const [isHealthModalOpen, setIsHealthModalOpen] = useState<boolean>(false)
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false)

  React.useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search)
      const tabParam = params.get('tab') as TabKey | null
      if (tabParam && ['overview', 'buildings', 'roads', 'about'].includes(tabParam)) {
        setActiveTab(tabParam)
      } else {
        const hashParam = window.location.hash.replace('#', '') as TabKey
        if (hashParam && ['overview', 'buildings', 'roads', 'about'].includes(hashParam)) {
          setActiveTab(hashParam)
        } else {
          setActiveTab('overview')
        }
      }
    }
    window.addEventListener('popstate', handlePopState)
    window.addEventListener('hashchange', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
      window.removeEventListener('hashchange', handlePopState)
    }
  }, [])

  const handleSwitchTab = (tab?: string) => {
    const validTab: TabKey = tab && ['overview', 'buildings', 'roads', 'about'].includes(tab)
      ? (tab as TabKey)
      : 'overview'
    setActiveTab(validTab)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      if (validTab === 'overview') {
        url.searchParams.delete('tab')
      } else {
        url.searchParams.set('tab', validTab)
      }
      window.history.replaceState({}, '', url.toString())
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f5f8fb] text-[#090e17]">
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

      {/* Trust & Scientific Disclaimer Footer */}
      <footer className="w-full border-t border-slate-200/80 bg-white/70 py-6 px-8 text-center text-xs text-slate-500 mt-16">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-left">
            <span className="font-bold text-slate-800">NEXSTORM</span> &bull; Amritsar Urban
            Resilience Platform
            <p className="text-[11px] text-slate-400 mt-0.5">
              Experimental research prototype. Not an official weather forecast or emergency
              warning. For official alerts see IMD and NDMA SACHET.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <button
              onClick={() => handleSwitchTab('overview')}
              className="text-slate-600 hover:text-blue-700 transition"
            >
              Overview
            </button>
            <button
              onClick={() => handleSwitchTab('buildings')}
              className="text-slate-600 hover:text-blue-700 transition"
            >
              Buildings
            </button>
            <button
              onClick={() => handleSwitchTab('roads')}
              className="text-slate-600 hover:text-blue-700 transition"
            >
              Roads
            </button>
            <button
              onClick={() => handleSwitchTab('about')}
              className="text-slate-600 hover:text-blue-700 transition"
            >
              About
            </button>
          </div>
        </div>
      </footer>

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
