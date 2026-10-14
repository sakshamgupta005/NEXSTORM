'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, Rocket, User as UserIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader, BreadcrumbItem } from './page-header'

export interface NavItem {
  title: string
  href: string
  icon?: React.ComponentType<{ className?: string }>
  badge?: React.ReactNode
  disabled?: boolean
  active?: boolean
}

export interface BrandConfig {
  name: string
  href?: string
  logo?: React.ReactNode
}

/**
 * 1. Base AppShell — Composable layout with customizable slots
 */
export function AppShell({
  header,
  sidebar,
  footer,
  children,
  className = '',
}: {
  header?: React.ReactNode
  sidebar?: React.ReactNode
  footer?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 ${className}`}>
      {header}
      <div className="flex flex-1 min-w-0">
        {sidebar}
        <main className="flex-1 min-w-0" role="main">
          {children}
        </main>
      </div>
      {footer}
    </div>
  )
}

/**
 * 2. SidebarLayout — Responsive desktop sidebar + mobile drawer with keyboard/touch support
 */
export interface SidebarLayoutProps {
  brand?: BrandConfig
  navItems: NavItem[]
  currentPath?: string
  user?: { email?: string; name?: string } | null
  headerTitle?: string
  headerActions?: React.ReactNode
  sidebarFooter?: React.ReactNode
  children: React.ReactNode
  maxWidth?: '5xl' | '6xl' | '7xl' | 'full'
  className?: string
}

export function SidebarLayout({
  brand = { name: 'Hackathon Starter', href: '/dashboard' },
  navItems,
  currentPath,
  user,
  headerTitle,
  headerActions,
  sidebarFooter,
  children,
  maxWidth = '6xl',
  className = '',
}: SidebarLayoutProps) {
  const pathname = usePathname()
  const activePath = currentPath ?? pathname
  const [isOpen, setIsOpen] = React.useState(false)

  // Close mobile drawer on Escape key
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  // Prevent background scrolling when mobile drawer is open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const maxWidthClass = {
    '5xl': 'max-w-5xl',
    '6xl': 'max-w-6xl',
    '7xl': 'max-w-7xl',
    full: 'max-w-full',
  }[maxWidth]

  return (
    <div className={`flex min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 ${className}`}>
      {/* Mobile Drawer Backdrop */}
      {isOpen && (
        <div
          data-testid="sidebar-backdrop"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden backdrop-blur-sm motion-reduce:transition-none"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar (Desktop static / Mobile drawer) */}
      <aside
        data-testid="app-sidebar"
        aria-label="Application Sidebar"
        className={`fixed top-0 bottom-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-transform duration-200 motion-reduce:transition-none lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6">
          <Link
            href={brand.href ?? '/dashboard'}
            className="flex items-center space-x-2.5 font-bold tracking-tight text-slate-900 dark:text-slate-100"
          >
            {brand.logo ?? (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
                <Rocket className="h-4 w-4" />
              </div>
            )}
            <span className="text-base truncate">{brand.name}</span>
          </Link>
          <button
            onClick={() => setIsOpen(false)}
            className="lg:hidden text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav aria-label="Main Navigation" className="flex-1 space-y-1 p-4 overflow-y-auto">
          <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Navigation
          </div>
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = item.active !== undefined ? item.active : activePath === item.href
            return (
              <Link
                key={item.href}
                href={item.disabled ? '#' : item.href}
                onClick={(e) => {
                  if (item.disabled) e.preventDefault()
                  else setIsOpen(false)
                }}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-semibold'
                    : item.disabled
                    ? 'opacity-50 cursor-not-allowed text-slate-400'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  {Icon && <Icon className="h-4 w-4 shrink-0" />}
                  <span>{item.title}</span>
                </div>
                {item.badge && <div>{item.badge}</div>}
              </Link>
            )
          })}
        </nav>

        {/* Sidebar Footer / User section */}
        <div className="border-t border-slate-200 dark:border-slate-800 p-4">
          {sidebarFooter ?? (
            user ? (
              <div className="flex items-center gap-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 p-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-semibold text-xs shrink-0">
                  <UserIcon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-xs font-medium text-slate-900 dark:text-slate-100">
                    {user.email ?? user.name ?? 'User'}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">Authenticated</p>
                </div>
              </div>
            ) : null
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top Header */}
        <header
          role="banner"
          className="flex h-16 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 px-4 sm:px-6 backdrop-blur-sm"
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsOpen(true)}
              className="lg:hidden rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Open sidebar"
              aria-expanded={isOpen}
            >
              <Menu className="h-5 w-5" />
            </button>
            {headerTitle && (
              <h1 className="text-base sm:text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                {headerTitle}
              </h1>
            )}
          </div>

          {headerActions && (
            <div className="flex items-center gap-3">
              {headerActions}
            </div>
          )}
        </header>

        {/* Body Content */}
        <main role="main" className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className={`mx-auto ${maxWidthClass}`}>{children}</div>
        </main>
      </div>
    </div>
  )
}

/**
 * 3. TopNavLayout — Clean top navigation layout for simple utilities and dashboard apps
 */
export interface TopNavLayoutProps {
  brand?: BrandConfig
  navItems?: NavItem[]
  actions?: React.ReactNode
  user?: { email?: string; name?: string } | null
  footer?: React.ReactNode
  children: React.ReactNode
  maxWidth?: '5xl' | '6xl' | '7xl' | 'full'
  className?: string
}

export function TopNavLayout({
  brand = { name: 'Hackathon Starter', href: '/' },
  navItems = [],
  actions,
  user,
  footer,
  children,
  maxWidth = '6xl',
  className = '',
}: TopNavLayoutProps) {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)

  const maxWidthClass = {
    '5xl': 'max-w-5xl',
    '6xl': 'max-w-6xl',
    '7xl': 'max-w-7xl',
    full: 'max-w-full',
  }[maxWidth]

  return (
    <div className={`flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 ${className}`}>
      {/* Top Header */}
      <header
        role="banner"
        className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm"
      >
        <div className={`container mx-auto flex h-16 ${maxWidthClass} items-center justify-between px-4 sm:px-6`}>
          <div className="flex items-center gap-6">
            <Link
              href={brand.href ?? '/'}
              className="flex items-center space-x-2 font-bold tracking-tight text-slate-900 dark:text-slate-100"
            >
              {brand.logo}
              <span>{brand.name}</span>
            </Link>

            {/* Desktop Navigation Links */}
            <nav aria-label="Top Navigation" className="hidden md:flex items-center space-x-4 text-sm font-medium">
              {navItems.map((item) => {
                const isActive = item.active !== undefined ? item.active : pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.disabled ? '#' : item.href}
                    aria-current={isActive ? 'page' : undefined}
                    className={`transition-colors py-1 px-2 rounded-md ${
                      isActive
                        ? 'text-blue-600 dark:text-blue-400 font-semibold'
                        : item.disabled
                        ? 'opacity-50 cursor-not-allowed text-slate-400'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {item.title}
                  </Link>
                )
              })}
            </nav>
          </div>

          {/* Right Action buttons */}
          <div className="flex items-center gap-3">
            {user && (
              <div className="hidden sm:flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                <UserIcon className="h-3.5 w-3.5" />
                <span className="truncate max-w-[140px]">{user.email ?? user.name}</span>
              </div>
            )}
            {actions}
            {/* Mobile menu trigger */}
            {navItems.length > 0 && (
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Toggle navigation menu"
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            )}
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && navItems.length > 0 && (
          <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.disabled ? '#' : item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-md text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {item.title}
              </Link>
            ))}
          </div>
        )}
      </header>

      {/* Main Content */}
      <main role="main" className="flex-1 p-4 sm:p-6 lg:p-8">
        <div className={`container mx-auto ${maxWidthClass}`}>{children}</div>
      </main>

      {/* Optional Footer */}
      {footer}
    </div>
  )
}

/**
 * 4. DashboardLayout — Pre-configured layout with header metadata and structured content regions
 */
export interface DashboardLayoutProps {
  title: React.ReactNode
  description?: React.ReactNode
  breadcrumbs?: BreadcrumbItem[]
  actions?: React.ReactNode
  badge?: React.ReactNode
  navItems?: NavItem[]
  user?: { email?: string; name?: string } | null
  sidebarFooter?: React.ReactNode
  children: React.ReactNode
  maxWidth?: '5xl' | '6xl' | '7xl' | 'full'
  className?: string
}

export function DashboardLayout({
  title,
  description,
  breadcrumbs,
  actions,
  badge,
  navItems,
  user,
  sidebarFooter,
  children,
  maxWidth = '6xl',
  className = '',
}: DashboardLayoutProps) {
  const defaultNavItems: NavItem[] = navItems ?? [
    { title: 'Overview', href: '/dashboard' },
  ]

  return (
    <SidebarLayout
      navItems={defaultNavItems}
      user={user}
      sidebarFooter={sidebarFooter}
      maxWidth={maxWidth}
      className={className}
    >
      <div className="space-y-6">
        <PageHeader
          title={title}
          description={description}
          breadcrumbs={breadcrumbs}
          actions={actions}
          badge={badge}
        />
        {children}
      </div>
    </SidebarLayout>
  )
}

/**
 * 5. SettingsLayout — Two-column responsive layout with section tabs and settings panel
 */
export interface SettingsSection {
  id: string
  label: string
  description?: string
  icon?: React.ComponentType<{ className?: string }>
}

export interface SettingsLayoutProps {
  title?: string
  description?: string
  sections: SettingsSection[]
  activeSection: string
  onSectionChange: (id: string) => void
  children: React.ReactNode
  className?: string
}

export function SettingsLayout({
  title = 'Settings',
  description = 'Manage your preferences and workspace configuration.',
  sections,
  activeSection,
  onSectionChange,
  children,
  className = '',
}: SettingsLayoutProps) {
  return (
    <div className={`space-y-6 ${className}`}>
      <PageHeader title={title} description={description} />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Settings Navigation Sidebar */}
        <nav aria-label="Settings sections" className="space-y-1">
          {sections.map((section) => {
            const Icon = section.icon
            const isActive = activeSection === section.id
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => onSectionChange(section.id)}
                aria-current={isActive ? 'true' : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-semibold'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {Icon && <Icon className="h-4 w-4 shrink-0" />}
                <div className="flex-1 truncate">
                  <div>{section.label}</div>
                  {section.description && (
                    <div className="text-xs text-slate-400 font-normal truncate">
                      {section.description}
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </nav>

        {/* Content Panel */}
        <div className="md:col-span-3 min-w-0">
          {children}
        </div>
      </div>
    </div>
  )
}

/**
 * 6. AuthLayout — Focused authentication shell with card container and brand
 */
export interface AuthLayoutProps {
  brandName?: string
  brandLogo?: React.ReactNode
  backHref?: string
  backLabel?: string
  footer?: React.ReactNode
  children: React.ReactNode
  className?: string
}

export function AuthLayout({
  brandName = 'Hackathon Starter',
  brandLogo,
  backHref = '/',
  backLabel = 'Back to Home',
  footer,
  children,
  className = '',
}: AuthLayoutProps) {
  return (
    <div className={`flex min-h-screen flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 ${className}`}>
      {/* Back Link */}
      {backHref && (
        <div className="absolute top-4 left-4 sm:top-8 sm:left-8">
          <Link href={backHref}>
            <Button variant="ghost" size="sm" className="text-xs text-slate-600 dark:text-slate-400">
              ← {backLabel}
            </Button>
          </Link>
        </div>
      )}

      {/* Main Auth Container */}
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
            {brandLogo ?? <Rocket className="h-6 w-6" />}
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {brandName}
          </h2>
        </div>

        {/* Auth Card Content */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm">
          {children}
        </div>

        {/* Footer Notes */}
        {footer && (
          <div className="text-center text-xs text-slate-500 dark:text-slate-400">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * 7. MarketingLayout — Public marketing & landing page layout
 */
export interface MarketingLayoutProps {
  navbar?: React.ReactNode
  announcement?: React.ReactNode
  hero?: React.ReactNode
  footer?: React.ReactNode
  children: React.ReactNode
  className?: string
}

export function MarketingLayout({
  navbar,
  announcement,
  hero,
  footer,
  children,
  className = '',
}: MarketingLayoutProps) {
  return (
    <div className={`flex min-h-screen flex-col bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 ${className}`}>
      {announcement}
      {navbar}
      {hero}
      <main role="main" className="flex-1">
        {children}
      </main>
      {footer}
    </div>
  )
}
