'use client'

import * as React from 'react'
import { LineChartProps } from '@/lib/visualization/types'
import { calculateDomain, formatNumber } from '@/lib/visualization/formatters'
import { LoadingState, EmptyState, ErrorState } from '@/components/ui/state-views'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function LineChart({
  data,
  title,
  description,
  height = 280,
  loading = false,
  error = null,
  emptyMessage = 'No data available to display.',
  formatValue = (v) => formatNumber(v),
  color = '#2563eb',
  showDots = true,
  curve = 'linear',
  strokeWidth = 2.5,
  showGrid = true,
  className,
  'aria-label': ariaLabel,
  'data-testid': testId,
}: LineChartProps) {
  const [hoveredPoint, setHoveredPoint] = React.useState<{
    index: number
    x: number
    y: number
  } | null>(null)

  if (loading) {
    return (
      <Card className={cn('overflow-hidden', className)} data-testid={testId || 'line-chart-loading'}>
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
      <Card className={cn('overflow-hidden', className)} data-testid={testId || 'line-chart-error'}>
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
      <Card className={cn('overflow-hidden', className)} data-testid={testId || 'line-chart-empty'}>
        {title && (
          <CardHeader className="pb-2">
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </CardHeader>
        )}
        <CardContent className="p-6">
          <EmptyState title="No trend data" description={emptyMessage} className="h-[220px]" />
        </CardContent>
      </Card>
    )
  }

  // SVG Coordinates setup
  const svgWidth = 600
  const svgHeight = 240
  const paddingLeft = 45
  const paddingRight = 20
  const paddingTop = 20
  const paddingBottom = 35

  const chartWidth = svgWidth - paddingLeft - paddingRight
  const chartHeight = svgHeight - paddingTop - paddingBottom

  const { min, range } = calculateDomain(data)

  // Map data to coordinates
  const points = data.map((d, i) => {
    const x =
      data.length > 1
        ? paddingLeft + (i / (data.length - 1)) * chartWidth
        : paddingLeft + chartWidth / 2
    const y = paddingTop + chartHeight - ((d.value - min) / range) * chartHeight
    return { ...d, x, y, index: i }
  })

  // Generate SVG path string
  let pathD = ''
  if (points.length === 1) {
    pathD = `M ${paddingLeft},${points[0].y} L ${paddingLeft + chartWidth},${points[0].y}`
  } else if (curve === 'smooth' && points.length > 2) {
    pathD = `M ${points[0].x},${points[0].y}`
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = i > 0 ? points[i - 1] : points[i]
      const p1 = points[i]
      const p2 = points[i + 1]
      const p3 = i != points.length - 2 ? points[i + 2] : p2

      const cp1x = p1.x + (p2.x - p0.x) / 6
      const cp1y = p1.y + (p2.y - p0.y) / 6
      const cp2x = p2.x - (p3.x - p1.x) / 6
      const cp2y = p2.y - (p3.y - p1.y) / 6

      pathD += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`
    }
  } else {
    pathD = `M ${points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L ')}`
  }

  // Y-axis grid ticks (4 steps)
  const yTicks = [0, 0.33, 0.66, 1].map((pct) => {
    const value = min + pct * range
    const y = paddingTop + chartHeight - pct * chartHeight
    return { value, y }
  })

  const chartAriaLabel =
    ariaLabel ||
    `${title || 'Line chart'} showing ${data.length} data points from ${data[0].label} to ${data[data.length - 1].label}`

  return (
    <Card className={cn('overflow-hidden', className)} data-testid={testId || 'line-chart'}>
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
            <title>{title ? `${title} chart visual` : 'Line chart visual'}</title>
            <desc>{description ? `Chart detail: ${description}` : `Visual trend of values over categories`}</desc>

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

            {/* Line Path */}
            <path
              d={pathD}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Data Dots & X Labels */}
            {points.map((p, i) => {
              const isHovered = hoveredPoint?.index === i
              // Only render label if not too dense, or first/last/middle
              const shouldRenderLabel =
                data.length <= 10 ||
                i === 0 ||
                i === data.length - 1 ||
                i === Math.floor(data.length / 2)

              return (
                <g key={`point-${i}`}>
                  {showDots && (
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={isHovered ? 6 : 4}
                      fill={isHovered ? '#ffffff' : color}
                      stroke={color}
                      strokeWidth={isHovered ? 3 : 2}
                      className="cursor-pointer transition-all duration-150"
                      tabIndex={0}
                      role="button"
                      aria-label={`${p.label}: ${formatValue(p.value)}`}
                      onMouseEnter={() => setHoveredPoint({ index: i, x: p.x, y: p.y })}
                      onFocus={() => setHoveredPoint({ index: i, x: p.x, y: p.y })}
                      onBlur={() => setHoveredPoint(null)}
                    />
                  )}

                  {/* Invisible hit target for hover */}
                  <rect
                    x={p.x - 12}
                    y={paddingTop}
                    width={24}
                    height={chartHeight}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredPoint({ index: i, x: p.x, y: p.y })}
                  />

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
                y2={paddingTop + chartHeight}
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
