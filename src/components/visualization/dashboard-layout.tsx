'use client'

import * as React from 'react'
import { RotateCw, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PresetDateRange } from '@/lib/visualization/types'
import { cn } from '@/lib/utils'

export interface DashboardHeaderProps {
  title: string
  description?: string
  lastUpdated?: string | Date
  onRefresh?: () => void
  isRefreshing?: boolean
  actions?: React.ReactNode
  className?: string
}

export function DashboardHeader({
  title,
  description,
  lastUpdated,
  onRefresh,
  isRefreshing = false,
  actions,
  className,
}: DashboardHeaderProps) {
  const formattedLastUpdated =
    lastUpdated instanceof Date
      ? lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : lastUpdated

  return (
    <div
      className={cn(
        'flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800',
        className
      )}
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {description}
          </p>
        )}
      </div>

      <div className="flex items-center flex-wrap gap-2.5">
        {formattedLastUpdated && (
          <span className="text-xs text-slate-400 mr-2">
            Updated {formattedLastUpdated}
          </span>
        )}

        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="h-8 gap-1.5 text-xs"
            aria-label="Refresh dashboard data"
          >
            <RotateCw
              className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin text-blue-600')}
            />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </Button>
        )}

        {actions}
      </div>
    </div>
  )
}

export interface DashboardGridProps {
  children: React.ReactNode
  columns?: 1 | 2 | 3 | 4
  className?: string
}

export function DashboardGrid({
  children,
  columns = 4,
  className,
}: DashboardGridProps) {
  const colClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  }[columns]

  return (
    <div className={cn('grid gap-4 sm:gap-6', colClasses, className)}>
      {children}
    </div>
  )
}

export interface DashboardSectionProps {
  title?: string
  description?: string
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
}

export function DashboardSection({
  title,
  description,
  actions,
  children,
  className,
}: DashboardSectionProps) {
  return (
    <section className={cn('space-y-4', className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-4">
          <div>
            {title && (
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {title}
              </h2>
            )}
            {description && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

export interface DateRangeFilterProps {
  activePreset?: PresetDateRange
  onPresetChange: (preset: PresetDateRange) => void
  presets?: { id: PresetDateRange; label: string }[]
  className?: string
}

export function DateRangeFilter({
  activePreset = '30d',
  onPresetChange,
  presets = [
    { id: '7d', label: '7D' },
    { id: '30d', label: '30D' },
    { id: '90d', label: '90D' },
    { id: '1y', label: '1Y' },
    { id: 'all', label: 'ALL' },
  ],
  className,
}: DateRangeFilterProps) {
  return (
    <div
      role="group"
      aria-label="Filter by time period"
      className={cn(
        'inline-flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs',
        className
      )}
    >
      <Calendar className="h-3.5 w-3.5 text-slate-400 mx-2 shrink-0 hidden sm:inline" />
      {presets.map((preset) => {
        const isActive = activePreset === preset.id
        return (
          <button
            key={preset.id}
            type="button"
            aria-pressed={isActive}
            onClick={() => onPresetChange(preset.id)}
            className={cn(
              'px-2.5 py-1 font-medium rounded-md transition-all cursor-pointer',
              isActive
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            )}
          >
            {preset.label}
          </button>
        )
      })}
    </div>
  )
}
