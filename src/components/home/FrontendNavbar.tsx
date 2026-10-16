'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { AuthModal } from '@/components/auth/AuthModal'

export type TabKey = 'overview' | 'buildings' | 'roads' | 'about'

interface FrontendNavbarProps {
  activeTab?: TabKey
  onSelectTab?: (tab: TabKey) => void
  onOpenStatusModal?: () => void
  onOpenReportModal?: () => void
  onOpenAuthModal?: () => void
}

export function FrontendNavbar({
  activeTab = 'overview',
  onSelectTab,
  onOpenStatusModal,
  onOpenReportModal,
  onOpenAuthModal,
}: FrontendNavbarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const isHome = pathname === '/'
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)

  const handleTabClick = (tab: TabKey) => {
    if (isHome && onSelectTab) {
      onSelectTab(tab)
    } else {
      router.push(`/?tab=${tab}`)
    }
  }

  return (
    <header className="navbar relative w-full">
      <div className="nav-container relative flex items-center justify-between">
        {/* Brand Logo with Solid Nexstorm Hex-Vortex Icon */}
        <Link
          href="/"
          onClick={(e) => {
            if (isHome && onSelectTab) {
              e.preventDefault()
              onSelectTab('overview')
            }
          }}
          className="brand-logo z-10"
          id="brandLogoBtn"
          aria-label="NEXSTORM Home"
        >
          <div className="logo-wrapper">
            <svg
              className="logo-mark"
              width="38"
              height="38"
              viewBox="0 0 40 40"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect x="2" y="2" width="36" height="36" rx="10" fill="#0f172a" />
              <path
                d="M20 7L29 12.5V23.5L20 29L11 23.5V12.5L20 7Z"
                stroke="#94a3b8"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              <path d="M22 11L14 21H21L18 29L26 19H20L22 11Z" fill="#ffffff" />
              <circle cx="20" cy="20" r="2.2" fill="#2563eb" />
            </svg>
          </div>
          <div className="brand-name-group">
            <span className="brand-text">
              NEXSTORM<span className="brand-dot">.</span>
            </span>
            <span className="brand-subtag">URBAN RESILIENCE PLATFORM</span>
          </div>
        </Link>

        {/* Navigation Links: Overview -> Buildings -> Roads -> About Us (COMPLETELY CENTRALISED TO THE PAGE) */}
        <nav 
          aria-label="Main Navigation" 
          className="hidden md:flex items-center justify-center absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-auto"
        >
          <ul className="nav-links flex items-center gap-1.5 p-1 rounded-full bg-slate-100/90 backdrop-blur-md border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <li>
              <button
                type="button"
                className={`nav-item ${isHome && activeTab === 'overview' ? 'active-nav' : ''}`}
                data-tab="overview"
                aria-label="Overview"
                onClick={() => handleTabClick('overview')}
              >
                Overview
              </button>
            </li>
            <li>
              <button
                type="button"
                className={`nav-item ${isHome && activeTab === 'buildings' ? 'active-nav' : ''}`}
                data-tab="buildings"
                onClick={() => handleTabClick('buildings')}
              >
                Buildings
              </button>
            </li>
            <li>
              <button
                type="button"
                className={`nav-item ${isHome && activeTab === 'roads' ? 'active-nav' : ''}`}
                data-tab="roads"
                onClick={() => handleTabClick('roads')}
              >
                Roads
              </button>
            </li>
            <li>
              <button
                type="button"
                className={`nav-item ${isHome && activeTab === 'about' ? 'active-nav' : ''}`}
                data-tab="about"
                aria-label="About Us"
                onClick={() => handleTabClick('about')}
              >
                About Us
              </button>
            </li>
          </ul>
        </nav>

        {/* Actions Group: Live Status + Perfectly Aligned Sign In / Sign Up Buttons */}
        <div className="nav-actions flex items-center gap-2.5 shrink-0">
          {onOpenStatusModal && (
            <button
              type="button"
              className="btn-neumorphic btn-live-status cursor-pointer hidden md:inline-flex"
              id="liveStatusBtn"
              onClick={onOpenStatusModal}
              title="Inspect operational pipeline & data stream health"
            >
              <span className="pulse-indicator"></span>
              <span className="text-xs font-semibold">Live Pipeline Status</span>
            </button>
          )}

          {/* Premium Login Button */}
          <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200">
            <button
              type="button"
              onClick={() => {
                if (onOpenAuthModal) {
                  onOpenAuthModal()
                } else {
                  setIsAuthModalOpen(true)
                }
              }}
              id="loginNavBtn"
              title="Sign in to NEXSTORM Intelligence Platform"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 20px',
                borderRadius: 9999,
                border: '1px solid #1e293b',
                background: '#0f172a',
                color: '#f8fafc',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.18s',
                boxShadow: '0 2px 8px rgba(15,23,42,0.18)',
                whiteSpace: 'nowrap',
                letterSpacing: '0.01em',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = '#1e293b'
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(15,23,42,0.25)'
                e.currentTarget.style.transform = 'translateY(-1px)'
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = '#0f172a'
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(15,23,42,0.18)'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
              <span>Login</span>
            </button>
          </div>
        </div>
      </div>

      {/* Embedded Auth Modal with Sign In / Sign Up tabs */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialTab="signin"
      />
    </header>
  )
}


