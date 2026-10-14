'use client'

import * as React from 'react'
import { AreaChartProps } from '@/lib/visualization/types'
import { calculateDomain, formatNumber } from '@/lib/visualization/formatters'
import { LoadingState, EmptyState, ErrorState } from '@/components/ui/state-views'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function AreaChart({
  data,
  title,
  description,
  height = 280,
  loading = false,
  error = null,
  emptyMessage = 'No cumulative data available.',
  formatValue = (v) => formatNumber(v),
  color = '#2563eb',
  fillOpacity = 0.25,
  strokeWidth = 2.5,
  gradient = true,
  showGrid = true,
  className,
  'aria-label': ariaLabel,
  'data-testid': testId,
}: AreaChartProps) {
  const [hoveredPoint, setHoveredPoint] = React.useState<{
    index: number
    x: number
    y: number
  } | null>(null)

  const gradientId = React.useId()

  if (loading) {
    return (
      <Card className={cn('overflow-hidden', className)} data-testid={testId || 'area-chart-loading'}>
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
      <Card className={cn('overflow-hidden', className)} data-testid={testId || 'area-chart-error'}>
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
      <Card className={cn('overflow-hidden', className)} data-testid={testId || 'area-chart-empty'}>
        {title && (
          <CardHeader className="pb-2">
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </CardHeader>
        )}
        <CardContent className="p-6">
          <EmptyState title="No area data" description={emptyMessage} className="h-[220px]" />
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

  const points = data.map((d, i) => {
    const x =
      data.length > 1
        ? paddingLeft + (i / (data.length - 1)) * chartWidth
        : paddingLeft + chartWidth / 2
    const y = paddingTop + chartHeight - ((d.value - min) / range) * chartHeight
    return { ...d, x, y, index: i }
  })

  // Line path
  const linePathD = `M ${points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L ')}`

  // Closed area path
  const baselineY = paddingTop + chartHeight
  const areaPathD = `${linePathD} L ${points[points.length - 1].x.toFixed(1)},${baselineY} L ${points[0].x.toFixed(1)},${baselineY} Z`

  const yTicks = [0, 0.33, 0.66, 1].map((pct) => {
    const value = min + pct * range
    const y = paddingTop + chartHeight - pct * chartHeight
    return { value, y }
  })

  const chartAriaLabel =
    ariaLabel ||
    `${title || 'Area chart'} showing cumulative data across ${data.length} intervals`

  return (
    <Card className={cn('overflow-hidden', className)} data-testid={testId || 'area-chart'}>
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
            onMouseLeave={() => setHoveredPoint(null)}
          >
            <title>{title ? `${title} chart visual` : 'Area chart visual'}</title>
            <desc>{description ? `Chart detail: ${description}` : `Visual area representation over intervals`}</desc>

            <defs>
              {gradient ? (
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={fillOpacity * 1.8} />
                  <stop offset="95%" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
              ) : null}
            </defs>

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
              y1={baselineY}
              x2={svgWidth - paddingRight}
              y2={baselineY}
              stroke="currentColor"
              className="text-slate-300 dark:text-slate-700"
              strokeWidth="1"
            />

            {/* Area Fill */}
            <path
              d={areaPathD}
              fill={gradient ? `url(#${gradientId})` : color}
              fillOpacity={gradient ? 1 : fillOpacity}
            />

            {/* Top Stroke */}
            <path
              d={linePathD}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Hit Areas and Points */}
            {points.map((p, i) => {
              const isHovered = hoveredPoint?.index === i
              const shouldRenderLabel =
                data.length <= 10 ||
                i === 0 ||
                i === data.length - 1 ||
                i === Math.floor(data.length / 2)

              return (
                <g key={`point-${i}`}>
                  {/* Invisible hit rect */}
                  <rect
                    x={p.x - 12}
                    y={paddingTop}
                    width={24}
                    height={chartHeight}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredPoint({ index: i, x: p.x, y: p.y })}
                  />

                  {isHovered && (
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={5}
                      fill="#ffffff"
                      stroke={color}
                      strokeWidth={3}
                    />
                  )}

                  {shouldRenderLabel && (
                    <text
                      x={p.x}
                      y={svgHeight - 10}
                      textAnchor="middle"
                      className="fill-slate-600 dark:fill-slate-400 text-[10px]"
                    >
                      {p.label}
                    </text>
                  )}
                </g>
              )
            })}

            {/* Active Vertical Guideline */}
            {hoveredPoint && (
              <line
                x1={hoveredPoint.x}
                y1={paddingTop}
                x2={hoveredPoint.x}
                y2={baselineY}
                stroke={color}
                strokeWidth="1.5"
                strokeDasharray="2 2"
                opacity="0.6"
              />
            )}
          </svg>

          {/* Floating Tooltip */}
          {hoveredPoint && (
            <div
              className="absolute pointer-events-none -translate-x-1/2 -translate-y-full z-10 rounded-md bg-slate-900 px-2.5 py-1.5 text-xs text-white shadow-lg dark:bg-slate-800 border border-slate-700"
              style={{
                left: `${(hoveredPoint.x / svgWidth) * 100}%`,
                top: `${(hoveredPoint.y / svgHeight) * 100}%`,
                marginTop: '-8px',
              }}
            >
              <div className="font-semibold">{data[hoveredPoint.index].label}</div>
              <div className="text-slate-300">
                {formatValue(data[hoveredPoint.index].value)}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
