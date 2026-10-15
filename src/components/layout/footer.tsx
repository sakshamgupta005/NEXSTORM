import React from 'react'
import Link from 'next/link'

export function Footer() {
  return (
    <footer className="w-full border-t border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md py-8 mt-12">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-slate-500">
          <div className="flex flex-col items-center md:items-start gap-1">
            <div className="flex items-center gap-2">
              <span className="font-display font-extrabold text-slate-900 dark:text-white">
                NEXSTORM<span className="text-blue-600">.</span>
              </span>
              <span className="text-slate-400">&bull;</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Urban Waterlogging &amp; Heavy-Rainfall Early-Warning Intelligence
              </span>
            </div>
            <p className="text-[11px] text-slate-400 text-center md:text-left">
              Amritsar Pilot City (31.634° N, 74.872° E) • BuildFest 2.0 PS-18 Research Prototype
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 font-semibold text-slate-600 dark:text-slate-300">
            <Link href="/" className="hover:text-blue-700 dark:hover:text-white transition">
              3-Pillar Home
            </Link>
            <Link href="/city/amritsar" className="hover:text-blue-700 dark:hover:text-white transition">
              250m Grid Console
            </Link>
            <Link href="/#buildings" className="hover:text-blue-700 dark:hover:text-white transition">
              Buildings
            </Link>
            <Link href="/#roads" className="hover:text-blue-700 dark:hover:text-white transition">
              Roads
            </Link>
            <Link href="/#about" className="hover:text-blue-700 dark:hover:text-white transition">
              About
            </Link>
            <Link href="/dashboard" className="hover:text-blue-700 dark:hover:text-white transition">
              Workspace
            </Link>
            <Link href="/login" className="hover:text-blue-700 dark:hover:text-white transition">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
