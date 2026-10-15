'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { Droplets, MapPin, Menu, X, ArrowUpRight } from 'lucide-react'

interface NavbarProps {
  user?: User | null
}

export function Navbar({ user }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md">
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Brand Logo & Name */}
        <Link
          href="/"
          className="flex items-center gap-3 group transition"
          aria-label="NEXSTORM Home"
        >
          <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-sm shrink-0">
            <svg
              width="24"
              height="24"
              viewBox="0 0 40 40"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect x="2" y="2" width="36" height="36" rx="10" fill="#0f172a" />
              <path
                d="M20 7L29 12.5V23.5L20 29L11 23.5V12.5L20 7Z"
                stroke="#94a3b8"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
              <path d="M22 11L14 21H21L18 29L26 19H20L22 11Z" fill="#ffffff" />
              <circle cx="20" cy="20" r="2.8" fill="#2563eb" />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="font-display font-extrabold text-base tracking-tight text-slate-900 dark:text-white leading-none">
              NEXSTORM<span className="text-blue-600">.</span>
            </span>
            <span className="text-[9px] font-bold tracking-widest text-slate-400 uppercase mt-0.5">
              Urban Resilience Platform
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav
          aria-label="Platform Navigation"
          className="hidden md:flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300"
        >
          <Link
            href="/"
            className="px-3 py-1.5 rounded-lg hover:text-blue-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            3-Pillar Home
          </Link>
          <Link
            href="/city/amritsar"
            className="px-3 py-1.5 rounded-lg text-blue-700 dark:text-blue-400 bg-blue-50/80 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/40 font-bold transition flex items-center gap-1"
          >
            <MapPin className="w-3 h-3 text-blue-600" />
            <span>250m Grid Console</span>
          </Link>
          <Link
            href="/#buildings"
            className="px-3 py-1.5 rounded-lg hover:text-blue-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            Buildings
          </Link>
          <Link
            href="/#roads"
            className="px-3 py-1.5 rounded-lg hover:text-blue-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            Roads
          </Link>
          <Link
            href="/#about"
            className="px-3 py-1.5 rounded-lg hover:text-blue-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            About
          </Link>
          <Link
            href="/dashboard"
            className="px-3 py-1.5 rounded-lg hover:text-blue-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            Workspace
          </Link>
        </nav>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-2">
          {user ? (
            <Link
              href="/dashboard"
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition"
            >
              Dashboard
            </Link>
          ) : (
            <div className="hidden sm:flex items-center gap-2">
              <Link
                href="/login"
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition"
              >
                Sign Up
              </Link>
            </div>
          )}

          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition"
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
