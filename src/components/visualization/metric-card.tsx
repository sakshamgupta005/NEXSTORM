'use client'

import * as React from 'react'
import { ArrowUpRight, ArrowDownRight, Minus, AlertCircle } from 'lucide-react'
import { Card, CardContent } from '@/lib/../components/ui/card'
import { Badge } from '@/lib/../components/ui/badge'
import { MetricCardProps } from '@/lib/visualization/types'
import { formatPercent, generateSparklinePath } from '@/lib/visualization/formatters'
import { cn } from '@/lib/utils'

export function MetricCard({
  title,
  value,
  previousValue,
  change,
  changePeriod = 'vs previous period',
  trend,
  icon: Icon,
  sparklineData,
  sparklineColor,
  description,
  loading = false,
  error = null,
  className,
  'data-testid': testId,
}: MetricCardProps) {
  if (loading) {
    return (
      <Card className={cn('animate-pulse', className)} data-testid={testId || 'metric-card-loading'}>
        <CardContent className="p-5">
          <div className="flex items-center justify-between space-x-2">
            <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
            <div className="h-6 w-6 bg-slate-200 dark:bg-slate-800 rounded-full" />
          </div>
          <div className="mt-4 h-8 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="mt-3 h-3 w-40 bg-slate-200 dark:bg-slate-800 rounded" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={cn('border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20', className)} data-testid={testId || 'metric-card-error'}>
        <CardContent className="p-5 flex items-start space-x-3 text-red-600 dark:text-red-400">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-red-700 dark:text-red-300">{title}</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Calculate or infer trend
  const resolvedTrend =
    trend ||
    (typeof change === 'number'
      ? change > 0
        ? 'up'
        : change < 0
        ? 'down'
        : 'neutral'
      : undefined)

  const sparkline = sparklineData && sparklineData.length >= 2
    ? generateSparklinePath(sparklineData, 80, 26)
    : null

  const resolvedSparklineColor =
    sparklineColor ||
    (resolvedTrend === 'up'
      ? '#10b981'
      : resolvedTrend === 'down'
      ? '#ef4444'
      : '#3b82f6')

  return (
    <Card
      className={cn('relative overflow-hidden transition-all duration-200 hover:shadow-md', className)}
      data-testid={testId || 'metric-card'}
      role="region"
      aria-label={`${title}: ${value}`}
    >
      <CardContent className="p-5">
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
          <span className="text-xs font-medium uppercase tracking-wider">{title}</span>
          {Icon && (
            <div className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              <Icon className="h-4 w-4" />
            </div>
          )}
        </div>

        <div className="mt-3 flex items-baseline justify-between">
          <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            {value}
          </div>

          {sparkline && (
            <div className="h-7 w-20 shrink-0" aria-hidden="true">
              <svg viewBox="0 0 80 26" className="w-full h-full overflow-visible">
                <path
                  d={sparkline.path}
                  fill="none"
                  stroke={resolvedSparklineColor}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          )}
        </div>

        {(change !== undefined || description || previousValue) && (
          <div className="mt-3 flex items-center space-x-2 text-xs">
            {change !== undefined && (
              <Badge
                variant={
                  resolvedTrend === 'up'
                    ? 'success'
                    : resolvedTrend === 'down'
                    ? 'danger'
                    : 'secondary'
                }
                className="flex items-center gap-0.5 px-1.5 py-0.5 font-semibold text-[11px]"
              >
                {resolvedTrend === 'up' && <ArrowUpRight className="h-3 w-3" />}
                {resolvedTrend === 'down' && <ArrowDownRight className="h-3 w-3" />}
                {resolvedTrend === 'neutral' && <Minus className="h-3 w-3" />}
                <span>{formatPercent(Math.abs(change), { decimals: 1 })}</span>
              </Badge>
            )}

            <span className="text-slate-500 dark:text-slate-400 truncate">
              {description || (previousValue ? `from ${previousValue} (${changePeriod})` : changePeriod)}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
