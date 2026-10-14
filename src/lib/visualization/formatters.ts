/**
 * Reusable formatting and data transformation utilities for data visualization.
 */

import { ChartDataPoint } from './types'

/**
 * Standard colors for data visualizations with high-contrast accessibility.
 */
export const DEFAULT_CHART_COLORS = [
  '#2563eb', // blue-600
  '#0d9488', // teal-600
  '#d97706', // amber-600
  '#7c3aed', // violet-600
  '#e11d48', // rose-600
  '#059669', // emerald-600
  '#ca8a04', // yellow-600
  '#4f46e5', // indigo-600
]

/**
 * Format numbers with optional compact notation (e.g. 1.2M, 45K).
 */
export function formatNumber(
  value: number,
  options: {
    decimals?: number
    notation?: 'standard' | 'compact'
    locale?: string
  } = {}
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '0'
  }

  const {
    notation = 'standard',
    decimals = notation === 'compact' ? 1 : 0,
    locale = 'en-US',
  } = options

  return new Intl.NumberFormat(locale, {
    notation,
    maximumFractionDigits: decimals,
    minimumFractionDigits: notation === 'compact' ? 0 : decimals,
  }).format(value)
}

/**
 * Format currency amounts with customizable currency code and compact notation.
 */
export function formatCurrency(
  value: number,
  options: {
    currency?: string
    decimals?: number
    notation?: 'standard' | 'compact'
    locale?: string
  } = {}
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '$0'
  }

  const {
    currency = 'USD',
    notation = 'standard',
    decimals = notation === 'compact' ? 1 : 0,
    locale = 'en-US',
  } = options

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    notation,
    maximumFractionDigits: decimals,
    minimumFractionDigits: notation === 'compact' ? 0 : decimals,
  }).format(value)
}

/**
 * Format percentages (e.g. 24.5%, +5.2%).
 */
export function formatPercent(
  value: number,
  options: {
    decimals?: number
    showSign?: boolean
    multiplyBy100?: boolean
    locale?: string
  } = {}
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '0%'
  }

  const {
    decimals = 1,
    showSign = false,
    multiplyBy100 = false,
    locale = 'en-US',
  } = options

  const numericVal = multiplyBy100 ? value * 100 : value
  const sign = showSign && numericVal > 0 ? '+' : ''

  const formatted = new Intl.NumberFormat(locale, {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(numericVal)

  return `${sign}${formatted}%`
}

/**
 * Format dates with standardized display modes.
 */
export function formatDate(
  input: string | number | Date,
  format: 'short' | 'medium' | 'long' | 'iso' = 'short',
  locale = 'en-US'
): string {
  if (!input) return ''

  const date = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(date.getTime())) {
    return String(input)
  }

  if (format === 'iso') {
    return date.toISOString().split('T')[0]
  }

  const optionsMap: Record<'short' | 'medium' | 'long', Intl.DateTimeFormatOptions> = {
    short: { month: 'short', day: 'numeric' },
    medium: { month: 'short', day: 'numeric', year: 'numeric' },
    long: { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' },
  }

  return new Intl.DateTimeFormat(locale, optionsMap[format]).format(date)
}

/**
 * Validate and sanitize chart input data.
 * Filters out invalid numbers (NaN, Infinity, null, undefined) or provides fallbacks.
 */
export function validateChartData(
  input: unknown,
  fallbackValue = 0
): { valid: boolean; data: ChartDataPoint[]; errors: string[] } {
  const errors: string[] = []

  if (!Array.isArray(input)) {
    return {
      valid: false,
      data: [],
      errors: ['Input is not an array'],
    }
  }

  const sanitized: ChartDataPoint[] = []

  input.forEach((item, index) => {
    if (!item || typeof item !== 'object') {
      errors.push(`Row ${index} is not an object`)
      return
    }

    const record = item as Record<string, unknown>
    const label = record.label !== undefined && record.label !== null ? String(record.label) : `Item ${index + 1}`
    const rawVal = record.value

    let value = fallbackValue
    if (typeof rawVal === 'number' && Number.isFinite(rawVal)) {
      value = rawVal
    } else if (typeof rawVal === 'string' && !Number.isNaN(Number(rawVal))) {
      value = Number(rawVal)
    } else {
      errors.push(`Row ${index} (${label}) has invalid value: ${String(rawVal)}`)
    }

    sanitized.push({
      ...record,
      label,
      value,
    })
  })

  return {
    valid: errors.length === 0,
    data: sanitized,
    errors,
  }
}

/**
 * Sorts dataset by value or label in ascending or descending order.
 */
export function sortBy<T>(
  items: T[],
  keyFn: (item: T) => string | number,
  direction: 'asc' | 'desc' = 'asc'
): T[] {
  return [...items].sort((a, b) => {
    const valA = keyFn(a)
    const valB = keyFn(b)

    if (valA < valB) return direction === 'asc' ? -1 : 1
    if (valA > valB) return direction === 'asc' ? 1 : -1
    return 0
  })
}

/**
 * Aggregates a list of records into ChartDataPoints grouped by key.
 */
export function aggregateBy<T>(
  items: T[],
  groupKeyFn: (item: T) => string,
  valueFn: (item: T) => number,
  operation: 'sum' | 'avg' | 'count' | 'min' | 'max' = 'sum'
): ChartDataPoint[] {
  if (!items || items.length === 0) return []

  const groups = new Map<string, number[]>()

  items.forEach((item) => {
    const key = groupKeyFn(item)
    const val = valueFn(item)
    if (!Number.isFinite(val)) return

    const existing = groups.get(key) || []
    existing.push(val)
    groups.set(key, existing)
  })

  const results: ChartDataPoint[] = []

  groups.forEach((values, label) => {
    let result = 0
    if (values.length > 0) {
      switch (operation) {
        case 'sum':
          result = values.reduce((acc, curr) => acc + curr, 0)
          break
        case 'avg':
          result = values.reduce((acc, curr) => acc + curr, 0) / values.length
          break
        case 'count':
          result = values.length
          break
        case 'min':
          result = Math.min(...values)
          break
        case 'max':
          result = Math.max(...values)
          break
      }
    }
    results.push({ label, value: result })
  })

  return results
}

/**
 * Calculates domain min and max for charts, providing a clean padded ceiling and floor.
 */
export function calculateDomain(
  data: ChartDataPoint[],
  includeZero = true
): { min: number; max: number; range: number } {
  if (data.length === 0) {
    return { min: 0, max: 100, range: 100 }
  }

  const values = data.map((d) => d.value)
  let min = Math.min(...values)
  let max = Math.max(...values)

  if (includeZero) {
    min = Math.min(0, min)
  }

  if (min === max) {
    max = max + 10
    min = Math.max(0, min - 10)
  }

  // Add 5% top padding for visual breathing room
  const padding = (max - min) * 0.05
  max = max + padding

  return {
    min,
    max,
    range: max - min || 1,
  }
}

/**
 * Converts sparkline data into a normalized SVG path string.
 */
export function generateSparklinePath(
  data: number[],
  width = 80,
  height = 24
): { path: string; isUp: boolean } {
  if (!data || data.length < 2) {
    return { path: `M 0,${height / 2} L ${width},${height / 2}`, isUp: true }
  }

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const padding = 2
  const effectiveHeight = height - padding * 2

  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * width
    const normalizedY = (val - min) / range
    // SVG y goes down
    const y = height - padding - normalizedY * effectiveHeight
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  const isUp = data[data.length - 1] >= data[0]

  return {
    path: `M ${points.join(' L ')}`,
    isUp,
  }
}
