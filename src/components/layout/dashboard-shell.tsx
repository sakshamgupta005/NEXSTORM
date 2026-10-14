'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import {
  Rocket,
  LayoutDashboard,
  BarChart3,
  Languages,
  Wifi,
  FileText,
  Sparkles,
  Layers,
  Settings,
  LogOut,
  Menu,
  X,
  User as UserIcon,
  ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface DashboardShellProps {
  user: User | null
  children: React.ReactNode
}

export function DashboardShell({ user, children }: DashboardShellProps) {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)

  const navItems = [
    { title: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    { title: 'Analytics Demo', href: '/dashboard/analytics', icon: BarChart3 },
    { title: 'Localization & a11y', href: '/dashboard/localization', icon: Languages },
    { title: 'PWA & Offline', href: '/dashboard/pwa', icon: Wifi },
    { title: 'Forms & Validation', href: '/dashboard/forms', icon: FileText },
    { title: 'AI Evaluation', href: '/dashboard/ai-eval', icon: Sparkles },
    { title: 'Project Modules', href: '/dashboard/modules', icon: Layers, disabled: true },
    { title: 'Configuration', href: '/dashboard/settings', icon: Settings, disabled: true },
  ]

  const userEmail = user?.email ?? 'dev@example.com'

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Mobile Menu Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden backdrop-blur-sm"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6">
          <Link href="/dashboard" className="flex items-center space-x-2.5 font-bold tracking-tight">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
              <Rocket className="h-4 w-4" />
            </div>
            <span className="text-base">Hackathon<span className="text-blue-600 dark:text-blue-400">Starter</span></span>
          </Link>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1.5 p-4">
          <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Navigation
          </div>
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.disabled ? '#' : item.href}
                onClick={(e) => {
                  if (item.disabled) e.preventDefault()
                  else setMobileMenuOpen(false)
                }}
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-semibold'
                    : item.disabled
                    ? 'opacity-50 cursor-not-allowed text-slate-400'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </div>
                {item.disabled && (
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                    Soon
                  </Badge>
                )}
              </Link>
            )
          })}
        </nav>

        {/* User Card & Logout in Sidebar Footer */}
        <div className="border-t border-slate-200 dark:border-slate-800 p-4">
          <div className="mb-3 flex items-center gap-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 p-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-semibold text-xs">
              <UserIcon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-xs font-medium text-slate-900 dark:text-slate-100">
                {userEmail}
              </p>
              <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="h-3 w-3" />
                <span>Verified Session</span>
              </div>
            </div>
          </div>

          <form action="/auth/signout" method="POST">
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="w-full justify-center gap-2 text-red-600 dark:text-red-400 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 border-red-200 dark:border-red-900/50"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </form>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top Header */}
        <header className="flex h-16 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 px-4 sm:px-6 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Open sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-base sm:text-lg font-semibold tracking-tight">
              Application Workspace
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="sm">
                View Landing Page
              </Button>
            </Link>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  )
}
