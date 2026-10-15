'use client'

import React from 'react'
import Link from 'next/link'

export type TabKey = 'overview' | 'buildings' | 'roads' | 'about'

interface FrontendNavbarProps {
  activeTab: TabKey
  onSelectTab: (tab: TabKey) => void
  onOpenStatusModal: () => void
  onOpenReportModal?: () => void
}

export function FrontendNavbar({
  activeTab,
  onSelectTab,
  onOpenStatusModal,
  onOpenReportModal,
}: FrontendNavbarProps) {
  return (
    <header className="navbar">
      <div className="nav-container">
        {/* Brand Logo with Solid Nexstorm Hex-Vortex Icon */}
        <a
          href="#overview"
          onClick={(e) => {
            e.preventDefault()
            onSelectTab('overview')
          }}
          className="brand-logo"
          id="brandLogoBtn"
          aria-label="NEXSTORM Home"
        >
          <div className="logo-wrapper">
            <svg
              className="logo-mark"
              width="40"
              height="40"
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
        </a>

        {/* Navigation Links: Overview -> Buildings -> Roads -> About Us */}
        <nav aria-label="Main Navigation">
          <ul className="nav-links">
            <li>
              <button
                type="button"
                className={`nav-item ${activeTab === 'overview' ? 'active-nav' : ''}`}
                data-tab="overview"
                onClick={() => onSelectTab('overview')}
              >
                Overview
              </button>
            </li>
            <li>
              <button
                type="button"
                className={`nav-item ${activeTab === 'buildings' ? 'active-nav' : ''}`}
                data-tab="buildings"
                onClick={() => onSelectTab('buildings')}
              >
                Buildings
              </button>
            </li>
            <li>
              <button
                type="button"
                className={`nav-item ${activeTab === 'roads' ? 'active-nav' : ''}`}
                data-tab="roads"
                onClick={() => onSelectTab('roads')}
              >
                Roads
              </button>
            </li>
            <li>
              <button
                type="button"
                className={`nav-item ${activeTab === 'about' ? 'active-nav' : ''}`}
                data-tab="about"
                onClick={() => onSelectTab('about')}
              >
                About Us
              </button>
            </li>
          </ul>
        </nav>

        {/* Actions Group */}
        <div className="nav-actions flex items-center gap-3">
          {onOpenReportModal && (
            <button
              type="button"
              onClick={onOpenReportModal}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 transition"
              title="Submit verified citizen ground truth"
            >
              <span>💧</span>
              <span>Report Flood</span>
            </button>
          )}

          <button
            type="button"
            className="btn-neumorphic btn-live-status"
            id="liveStatusBtn"
            onClick={onOpenStatusModal}
            title="Inspect operational pipeline & sensor data streams"
          >
            <span className="pulse-indicator"></span>
            <span>Live Pipeline Status</span>
          </button>

          {/* Discreet auth links for platform sign-in */}
          <div className="hidden md:flex items-center gap-2 pl-2 border-l border-slate-300">
            <Link
              href="/login"
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-2 py-1"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="text-xs font-semibold text-blue-700 hover:text-blue-900 px-2 py-1"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}
