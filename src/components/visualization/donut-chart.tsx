'use client'

import * as React from 'react'
import { DonutChartProps } from '@/lib/visualization/types'
import { formatNumber, formatPercent, DEFAULT_CHART_COLORS } from '@/lib/visualization/formatters'
import { LoadingState, EmptyState, ErrorState } from '@/components/ui/state-views'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function DonutChart({
  data,
  title,
  description,
  height = 280,
  loading = false,
  error = null,
  emptyMessage = 'No proportional data available.',
  formatValue = (v) => formatNumber(v),
  colors = DEFAULT_CHART_COLORS,
  innerRadiusRatio = 0.65,
  centerLabel = 'Total',
  centerValue,
  showLegend = true,
  className,
  'aria-label': ariaLabel,
  'data-testid': testId,
}: DonutChartProps) {
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null)

  if (loading) {
    return (
      <Card className={cn('overflow-hidden', className)} data-testid={testId || 'donut-chart-loading'}>
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
      <Card className={cn('overflow-hidden', className)} data-testid={testId || 'donut-chart-error'}>
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

  const validData = (data || []).filter((d) => d && d.value > 0)
  const total = validData.reduce((acc, curr) => acc + curr.value, 0)

  if (validData.length === 0 || total === 0) {
    return (
      <Card className={cn('overflow-hidden', className)} data-testid={testId || 'donut-chart-empty'}>
        {title && (
          <CardHeader className="pb-2">
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </CardHeader>
        )}
        <CardContent className="p-6">
          <EmptyState title="No proportion data" description={emptyMessage} className="h-[220px]" />
        </CardContent>
      </Card>
    )
  }

  // SVG dimensions
  const size = 220
  const center = size / 2
  const outerRadius = 90
  const innerRadius = outerRadius * innerRadiusRatio

  // Generate pie/donut arc paths purely functionally
  const slices = validData.map((d, index) => {
    const fraction = d.value / total
    const sliceAngle = fraction * 2 * Math.PI

    // Pure functional start angle derived from preceding slices
    const precedingFraction = validData
      .slice(0, index)
      .reduce((sum, item) => sum + item.value / total, 0)
    const startAngle = -Math.PI / 2 + precedingFraction * 2 * Math.PI
    const endAngle = startAngle + sliceAngle

    const isHovered = hoveredIndex === index
    const activeOuterRadius = isHovered ? outerRadius + 4 : outerRadius

    const x1 = center + activeOuterRadius * Math.cos(startAngle)
    const y1 = center + activeOuterRadius * Math.sin(startAngle)
    const x2 = center + activeOuterRadius * Math.cos(endAngle)
    const y2 = center + activeOuterRadius * Math.sin(endAngle)

    const x3 = center + innerRadius * Math.cos(endAngle)
    const y3 = center + innerRadius * Math.sin(endAngle)
    const x4 = center + innerRadius * Math.cos(startAngle)
    const y4 = center + innerRadius * Math.sin(startAngle)

    const largeArc = sliceAngle > Math.PI ? 1 : 0

    // SVG arc command
    const pathD = [
      `M ${x1.toFixed(2)} ${y1.toFixed(2)}`,
      `A ${activeOuterRadius} ${activeOuterRadius} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
      `L ${x3.toFixed(2)} ${y3.toFixed(2)}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4.toFixed(2)} ${y4.toFixed(2)}`,
      'Z',
    ].join(' ')

    const sliceColor = d.color || colors[index % colors.length]

    return {
      ...d,
      index,
      fraction,
      percentage: fraction * 100,
      pathD,
      color: sliceColor,
      isHovered,
    }
  })

  const displayCenterValue =
    hoveredIndex !== null && slices[hoveredIndex]
      ? formatValue(slices[hoveredIndex].value)
      : centerValue !== undefined
      ? String(centerValue)
      : formatValue(total)

  const displayCenterLabel =
    hoveredIndex !== null && slices[hoveredIndex]
      ? slices[hoveredIndex].label
      : centerLabel

  const chartAriaLabel =
    ariaLabel ||
    `${title || 'Donut chart'} showing ${validData.length} categories with total ${formatValue(total)}`

  return (
    <Card className={cn('overflow-hidden', className)} data-testid={testId || 'donut-chart'}>
      {title && (
        <CardHeader className="pb-2">
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent className="p-4 pt-1">
        <div
          className={cn(
            'flex flex-col md:flex-row items-center justify-center gap-6',
            !showLegend && 'justify-center'
          )}
          style={{ minHeight: height }}
        >
          {/* SVG Donut */}
          <div className="relative shrink-0" style={{ width: size, height: size }}>
            <svg
              viewBox={`0 0 ${size} ${size}`}
              className="w-full h-full select-none overflow-visible"
              role="img"
              aria-label={chartAriaLabel}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <title>{title ? `${title} chart visual` : 'Donut chart visual'}</title>
              <desc>{description ? `Chart detail: ${description}` : `Visual proportion distribution`}</desc>

              {slices.map((slice) => (
                <path
                  key={`slice-${slice.index}`}
                  d={slice.pathD}
                  fill={slice.color}
                  className={cn(
                    'cursor-pointer transition-all duration-150',
                    slice.isHovered
                      ? 'brightness-110 drop-shadow-md'
                      : 'opacity-90 hover:opacity-100'
                  )}
                  tabIndex={0}
                  role="button"
                  aria-label={`${slice.label}: ${formatValue(slice.value)} (${formatPercent(slice.fraction, { multiplyBy100: true })})`}
                  onMouseEnter={() => setHoveredIndex(slice.index)}
                  onFocus={() => setHoveredIndex(slice.index)}
                  onBlur={() => setHoveredIndex(null)}
                />
              ))}

              {/* Center Labels */}
              <text
                x={center}
                y={center - 4}
                textAnchor="middle"
                className="fill-slate-900 dark:fill-slate-50 font-bold text-base"
              >
                {displayCenterValue}
              </text>
              <text
                x={center}
                y={center + 14}
                textAnchor="middle"
                className="fill-slate-500 dark:fill-slate-400 text-[11px]"
              >
                {displayCenterLabel}
              </text>
            </svg>
          </div>

          {/* Color Legend */}
          {showLegend && (
            <div className="flex flex-col gap-2 w-full max-w-xs text-xs">
              {slices.map((slice) => (
                <div
                  key={`legend-${slice.index}`}
                  className={cn(
                    'flex items-center justify-between p-1.5 rounded-md cursor-pointer transition-colors',
                    slice.isHovered
                      ? 'bg-slate-100 dark:bg-slate-800'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  )}
                  onMouseEnter={() => setHoveredIndex(slice.index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: slice.color }}
                      aria-hidden="true"
                    />
                    <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                      {slice.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono shrink-0 ml-2">
                    <span className="text-slate-500 dark:text-slate-400">
                      {formatValue(slice.value)}
                    </span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300 w-12 text-right">
                      {formatPercent(slice.fraction, { multiplyBy100: true })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
