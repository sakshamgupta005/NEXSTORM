'use client'

import React from 'react'
import { PageHeader, BreadcrumbItem } from '@/components/layout/page-header'
import { ErrorState, PageSkeletonState } from '@/components/ui/state-views'

export interface DetailTab {
  id: string
  label: string
  count?: string | number
}

export interface DetailPageTemplateProps {
  title: React.ReactNode
  subtitle?: React.ReactNode
  breadcrumbs?: BreadcrumbItem[]
  backHref?: string
  backLabel?: string
  badges?: React.ReactNode
  actions?: React.ReactNode
  tabs?: DetailTab[]
  activeTab?: string
  onTabChange?: (id: string) => void
  sidebar?: React.ReactNode
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
  children: React.ReactNode
  className?: string
}

export function DetailPageTemplate({
  title,
  subtitle,
  breadcrumbs,
  backHref,
  backLabel,
  badges,
  actions,
  tabs,
  activeTab,
  onTabChange,
  sidebar,
  isLoading = false,
  error = null,
  onRetry,
  children,
  className = '',
}: DetailPageTemplateProps) {
  if (isLoading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <PageSkeletonState cardsCount={2} />
      </div>
    )
  }

  if (error) {
    return (
      <div className={`space-y-6 ${className}`}>
        <PageHeader
          title={title}
          backHref={backHref}
          backLabel={backLabel}
          breadcrumbs={breadcrumbs}
        />
        <ErrorState
          title="Failed to load details"
          description={error}
          actionLabel={onRetry ? 'Retry' : undefined}
          onAction={onRetry}
        />
      </div>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <PageHeader
        title={title}
        description={subtitle}
        breadcrumbs={breadcrumbs}
        backHref={backHref}
        backLabel={backLabel}
        badge={badges}
        actions={actions}
      />

      {/* Tabs Navigation (if provided) */}
      {tabs && tabs.length > 0 && onTabChange && (
        <div className="border-b border-slate-200 dark:border-slate-800">
          <nav aria-label="Detail Sections" className="flex space-x-6 -mb-px overflow-x-auto">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onTabChange(tab.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`py-3 px-1 border-b-2 text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${
                    isActive
                      ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                      : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-600 dark:text-slate-300">
                      {tab.count}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
        </div>
      )}

      {/* Content Layout (Main + Sidebar) */}
      <div className={`grid gap-6 ${sidebar ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1'}`}>
        <div className={sidebar ? 'lg:col-span-2 space-y-6 min-w-0' : 'space-y-6 min-w-0'}>
          {children}
        </div>
        {sidebar && (
          <aside className="space-y-6 min-w-0" aria-label="Metadata and properties">
            {sidebar}
          </aside>
        )}
      </div>
    </div>
  )
}
