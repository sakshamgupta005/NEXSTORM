'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { MapPin, Menu, X } from 'lucide-react'

interface NavbarProps {
  user?: User | null
}

export function Navbar({ user }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="navbar sticky top-0 z-50 bg-[#f6f8fc]/95 dark:bg-slate-950/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80">
      <div className="nav-container">
        {/* Brand Logo & Name */}
        <Link
          href="/"
          className="brand-logo"
          aria-label="NEXSTORM Home"
        >
          <div className="logo-wrapper">
            <svg
              className="logo-mark"
              width="36"
              height="36"
              viewBox="0 0 40 40"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect x="2" y="2" width="36" height="36" rx="10" fill="#0f172a" />
              <path
                d="M20 7L29 12.5V23.5L20 29L11 23.5V12.5L20 7Z"
                stroke="#94a3b8"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <path d="M22 11L14 21H21L18 29L26 19H20L22 11Z" fill="#ffffff" />
              <circle cx="20" cy="20" r="2.5" fill="#2563eb" />
            </svg>
          </div>
          <div className="brand-name-group">
            <span className="brand-text">
              NEXSTORM<span className="brand-dot">.</span>
            </span>
            <span className="brand-subtag">URBAN RESILIENCE PLATFORM</span>
          </div>
        </Link>

        {/* Desktop Navigation Links Pill Group */}
        <nav aria-label="Platform Navigation" className="hidden lg:block">
          <ul className="nav-links">
            <li>
              <Link
                href="/"
                className="nav-item hover:text-blue-700 dark:hover:text-white transition"
              >
                3-Pillar Home
              </Link>
            </li>
            <li>
              <Link
                href="/city/amritsar"
                className="nav-item active-nav flex items-center gap-1.5 shadow-sm"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>250m Grid Console</span>
              </Link>
            </li>
            <li>
              <Link
                href="/#buildings"
                className="nav-item hover:text-blue-700 dark:hover:text-white transition"
              >
                Buildings
              </Link>
            </li>
            <li>
              <Link
                href="/#roads"
                className="nav-item hover:text-blue-700 dark:hover:text-white transition"
              >
                Roads
              </Link>
            </li>
            <li>
              <Link
                href="/#about"
                className="nav-item hover:text-blue-700 dark:hover:text-white transition"
              >
                About
              </Link>
            </li>
            <li>
              <Link
                href="/dashboard"
                className="nav-item hover:text-blue-700 dark:hover:text-white transition"
              >
                Workspace
              </Link>
            </li>
          </ul>
        </nav>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-2.5">
          {user ? (
            <Link
              href="/dashboard"
              className="px-4 py-2 text-xs font-bold rounded-full bg-blue-700 hover:bg-blue-800 text-white shadow-xs transition"
            >
              Dashboard
            </Link>
          ) : (
            <div className="hidden sm:flex items-center gap-2">
              <Link
                href="/login"
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-blue-700 dark:hover:text-white transition"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="px-4 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-full shadow-xs transition"
              >
                Sign Up
              </Link>
            </div>
          )}

          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800 transition"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-3 space-y-1">
          <Link
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-lg"
          >
            3-Pillar Home
          </Link>
          <Link
            href="/city/amritsar"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 text-xs font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 rounded-lg"
          >
            250m Grid Console (Amritsar)
          </Link>
          <Link
            href="/#buildings"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-lg"
          >
            Buildings Exposure
          </Link>
          <Link
            href="/#roads"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-lg"
          >
            Roads &amp; Routing
          </Link>
          <Link
            href="/#about"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-lg"
          >
            About &amp; Pipeline
          </Link>
          <Link
            href="/dashboard"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-lg"
          >
            Research Workspace
          </Link>
          <div className="pt-2 flex items-center gap-2 border-t border-slate-100 dark:border-slate-800">
            <Link
              href="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="flex-1 text-center py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              onClick={() => setMobileMenuOpen(false)}
              className="flex-1 text-center py-2 text-xs font-bold text-white bg-blue-600 rounded-lg"
            >
              Sign Up
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
