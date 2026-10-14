'use client'

import * as React from 'react'
import { BarChartProps } from '@/lib/visualization/types'
import { calculateDomain, formatNumber, DEFAULT_CHART_COLORS } from '@/lib/visualization/formatters'
import { LoadingState, EmptyState, ErrorState } from '@/components/ui/state-views'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function BarChart({
  data,
  title,
  description,
  height = 280,
  loading = false,
  error = null,
  emptyMessage = 'No comparison data available.',
  formatValue = (v) => formatNumber(v),
  color = '#2563eb',
  colors = DEFAULT_CHART_COLORS,
  barRadius = 4,
  showGrid = true,
  className,
  'aria-label': ariaLabel,
  'data-testid': testId,
}: BarChartProps) {
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null)

  if (loading) {
    return (
      <Card className={cn('overflow-hidden', className)} data-testid={testId || 'bar-chart-loading'}>
        {title && (
          <CardHeader className="pb-2">
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </CardHeader>
        )}
        <CardContent className="p-6">
          <LoadingState title="Loading chart data..." className="h-[220px]" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={cn('overflow-hidden', className)} data-testid={testId || 'bar-chart-error'}>
        {title && (
          <CardHeader className="pb-2">
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </CardHeader>
        )}
        <CardContent className="p-6">
          <ErrorState title="Failed to load chart" description={error} className="h-[220px]" />
        </CardContent>
      </Card>
    )
  }

  if (!data || data.length === 0) {
    return (
      <Card className={cn('overflow-hidden', className)} data-testid={testId || 'bar-chart-empty'}>
        {title && (
          <CardHeader className="pb-2">
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </CardHeader>
        )}
        <CardContent className="p-6">
          <EmptyState title="No comparison data" description={emptyMessage} className="h-[220px]" />
        </CardContent>
      </Card>
    )
  }

  const svgWidth = 600
  const svgHeight = 240
  const paddingLeft = 45
  const paddingRight = 20
  const paddingTop = 20
  const paddingBottom = 35

  const chartWidth = svgWidth - paddingLeft - paddingRight
  const chartHeight = svgHeight - paddingTop - paddingBottom

  const { min, range } = calculateDomain(data)

  const barSlotWidth = chartWidth / data.length
  const barWidth = Math.min(Math.max(barSlotWidth * 0.65, 8), 48)

  const yTicks = [0, 0.33, 0.66, 1].map((pct) => {
    const value = min + pct * range
    const y = paddingTop + chartHeight - pct * chartHeight
    return { value, y }
  })

  const chartAriaLabel =
    ariaLabel ||
    `${title || 'Bar chart'} comparing ${data.length} categories`

  return (
    <Card className={cn('overflow-hidden', className)} data-testid={testId || 'bar-chart'}>
      {title && (
        <CardHeader className="pb-2">
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent className="p-4 pt-1">
        <div className="relative w-full" style={{ height }}>
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-full select-none overflow-visible"
            role="img"
            aria-label={chartAriaLabel}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <title>{title ? `${title} chart visual` : 'Bar chart visual'}</title>
            <desc>{description ? `Chart detail: ${description}` : `Visual bar comparison of categories`}</desc>

            {/* Grid & Y Axis */}
            {yTicks.map((tick, i) => (
              <g key={`y-tick-${i}`}>
                {showGrid && (
                  <line
                    x1={paddingLeft}
                    y1={tick.y}
                    x2={svgWidth - paddingRight}
                    y2={tick.y}
                    stroke="currentColor"
                    className="text-slate-200 dark:text-slate-800"
                    strokeDasharray="3 3"
                    strokeWidth="1"
                  />
                )}
                <text
                  x={paddingLeft - 8}
                  y={tick.y + 4}
                  textAnchor="end"
                  className="fill-slate-600 dark:fill-slate-400 text-[10px]"
                >
                  {formatValue(tick.value)}
                </text>
              </g>
            ))}

            {/* Baseline */}
            <line
              x1={paddingLeft}
              y1={paddingTop + chartHeight}
              x2={svgWidth - paddingRight}
              y2={paddingTop + chartHeight}
              stroke="currentColor"
              className="text-slate-300 dark:text-slate-700"
              strokeWidth="1"
            />

            {/* Bars */}
            {data.map((item, i) => {
              const barHeight = Math.max(((item.value - min) / range) * chartHeight, 2)
              const x = paddingLeft + i * barSlotWidth + (barSlotWidth - barWidth) / 2
              const y = paddingTop + chartHeight - barHeight
              const isHovered = hoveredIndex === i
              const barFill = item.color || colors[i % colors.length] || color

              return (
                <g key={`bar-${i}`}>
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    rx={barRadius}
                    ry={barRadius}
                    fill={barFill}
                    className={cn(
                      'cursor-pointer transition-all duration-150',
                      isHovered ? 'brightness-110 shadow-lg' : 'opacity-90 hover:opacity-100'
                    )}
                    tabIndex={0}
                    role="button"
                    aria-label={`${item.label}: ${formatValue(item.value)}`}
                    onMouseEnter={() => setHoveredIndex(i)}
                    onFocus={() => setHoveredIndex(i)}
                    onBlur={() => setHoveredIndex(null)}
                  />

                  {/* X Axis Label */}
                  <text
                    x={x + barWidth / 2}
                    y={svgHeight - 12}
                    textAnchor="middle"
                    className="fill-slate-600 dark:fill-slate-400 text-[10px]"
                  >
                    {item.label}
                  </text>
                </g>
              )
            })}
          </svg>

          {/* Floating Tooltip */}
          {hoveredIndex !== null && data[hoveredIndex] && (
            <div
              className="absolute pointer-events-none -translate-x-1/2 -translate-y-full z-10 rounded-md bg-slate-900 px-2.5 py-1.5 text-xs text-white shadow-lg dark:bg-slate-800 border border-slate-700"
              style={{
                left: `${
                  ((paddingLeft +
                    hoveredIndex * barSlotWidth +
                    barSlotWidth / 2) /
                    svgWidth) *
                  100
                }%`,
                top: `${
                  ((paddingTop +
                    chartHeight -
                    Math.max(
                      ((data[hoveredIndex].value - min) / range) *
                        chartHeight,
                      2
                    )) /
                    svgHeight) *
                  100
                }%`,
                marginTop: '-8px',
              }}
            >
              <div className="font-semibold">{data[hoveredIndex].label}</div>
              <div className="text-slate-300">
                {formatValue(data[hoveredIndex].value)}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
