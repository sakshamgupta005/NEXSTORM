'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader, BreadcrumbItem } from '@/components/layout/page-header'
import { ErrorState, PageSkeletonState } from '@/components/ui/state-views'
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'

export interface DashboardStatItem {
  title: string
  value: string | number
  change?: string
  changeType?: 'positive' | 'negative' | 'neutral'
  description?: string
  icon?: React.ComponentType<{ className?: string }>
}

export interface DashboardOverviewTemplateProps {
  title?: React.ReactNode
  description?: React.ReactNode
  breadcrumbs?: BreadcrumbItem[]
  actions?: React.ReactNode
  stats?: DashboardStatItem[]
  mainContent: React.ReactNode
  sideContent?: React.ReactNode
  quickActions?: React.ReactNode
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
  className?: string
}

export function DashboardOverviewTemplate({
  title = 'Dashboard Overview',
  description = 'High-level metrics, system activity, and key actions.',
  breadcrumbs,
  actions,
  stats = [],
  mainContent,
  sideContent,
  quickActions,
  isLoading = false,
  error = null,
  onRetry,
  className = '',
}: DashboardOverviewTemplateProps) {
  if (isLoading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <PageSkeletonState cardsCount={stats.length || 3} />
      </div>
    )
  }

  if (error) {
    return (
      <div className={`space-y-6 ${className}`}>
        <PageHeader title={title} description={description} breadcrumbs={breadcrumbs} />
        <ErrorState
          title="Failed to load dashboard"
          description={error}
          actionLabel={onRetry ? 'Retry' : undefined}
          onAction={onRetry}
        />
      </div>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Page Header */}
      <PageHeader
        title={title}
        description={description}
        breadcrumbs={breadcrumbs}
        actions={actions}
      />

      {/* Quick Actions Bar (if provided) */}
      {quickActions && (
        <div className="flex items-center gap-3 overflow-x-auto pb-1">
          {quickActions}
        </div>
      )}

      {/* Metrics / KPI Grid */}
      {stats.length > 0 && (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, idx) => {
            const Icon = stat.icon
            return (
              <Card key={idx} className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {stat.title}
                  </CardTitle>
                  {Icon && <Icon className="h-4 w-4 text-slate-400" />}
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                    {stat.value}
                  </div>
                  {(stat.change || stat.description) && (
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      {stat.change && (
                        <span
                          className={`inline-flex items-center font-medium ${
                            stat.changeType === 'positive'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : stat.changeType === 'negative'
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-slate-500'
                          }`}
                        >
                          {stat.changeType === 'positive' && <ArrowUpRight className="h-3 w-3 mr-0.5" />}
                          {stat.changeType === 'negative' && <ArrowDownRight className="h-3 w-3 mr-0.5" />}
                          {stat.changeType === 'neutral' && <Minus className="h-3 w-3 mr-0.5" />}
                          {stat.change}
                        </span>
                      )}
                      {stat.description && <span>{stat.description}</span>}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Main Grid Content */}
      <div className={`grid gap-6 ${sideContent ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1'}`}>
        <div className={sideContent ? 'lg:col-span-2 space-y-6' : 'space-y-6'}>
          {mainContent}
        </div>
        {sideContent && (
          <div className="space-y-6">
            {sideContent}
          </div>
        )}
      </div>
    </div>
  )
}
