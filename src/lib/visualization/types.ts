/**
 * Core type definitions for data visualization and dashboard components.
 */

export interface ChartDataPoint {
  label: string
  value: number
  color?: string
  formattedValue?: string
  [key: string]: unknown
}

export interface TimeSeriesPoint {
  timestamp: string | number | Date
  value: number
  label?: string
  [key: string]: unknown
}

export interface MultiSeriesDataPoint {
  label: string
  [seriesKey: string]: string | number | undefined
}

export interface ChartSeries {
  name: string
  key: string
  color: string
}

export type TrendDirection = 'up' | 'down' | 'neutral'

export interface MetricCardProps {
  title: string
  value: string | number
  previousValue?: string | number
  change?: number
  changePeriod?: string
  trend?: TrendDirection
  icon?: React.ComponentType<{ className?: string }>
  sparklineData?: number[]
  sparklineColor?: string
  description?: string
  loading?: boolean
  error?: string | null
  className?: string
  'data-testid'?: string
}

export interface ChartCommonProps {
  data: ChartDataPoint[]
  title?: string
  description?: string
  height?: number
  width?: number | string
  loading?: boolean
  error?: string | null
  emptyMessage?: string
  formatValue?: (val: number) => string
  color?: string
  colors?: string[]
  className?: string
  showGrid?: boolean
  showTooltip?: boolean
  animate?: boolean
  'aria-label'?: string
  'data-testid'?: string
}

export interface LineChartProps extends ChartCommonProps {
  showDots?: boolean
  curve?: 'linear' | 'smooth'
  strokeWidth?: number
}

export interface AreaChartProps extends ChartCommonProps {
  fillOpacity?: number
  strokeWidth?: number
  gradient?: boolean
}

export interface BarChartProps extends ChartCommonProps {
  barRadius?: number
  horizontal?: boolean
}

export interface DonutChartProps extends ChartCommonProps {
  innerRadiusRatio?: number
  centerLabel?: string
  centerValue?: string | number
  showLegend?: boolean
}

export interface DateRange {
  from: string
  to: string
  label?: string
}

export type PresetDateRange = '7d' | '30d' | '90d' | '1y' | 'all'
