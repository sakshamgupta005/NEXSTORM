/**
 * Locale-aware date, number, currency, and relative time formatters.
 */

import {
  CurrencyFormatOptions,
  DateFormatOptions,
  LocaleCode,
  NumberFormatOptions,
} from './types'
import { DEFAULT_LOCALE } from './locales'

/**
 * Format dates with locale and optional timezone sensitivity.
 */
export function formatLocaleDate(
  date: Date | string | number,
  locale: LocaleCode = DEFAULT_LOCALE,
  options: DateFormatOptions = {}
): string {
  if (!date) return ''

  const resolvedDate = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(resolvedDate.getTime())) {
    return String(date)
  }

  const { timezone, ...intlOptions } = options

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(timezone ? { timeZone: timezone } : {}),
    ...intlOptions,
  }

  try {
    return new Intl.DateTimeFormat(locale, defaultOptions).format(resolvedDate)
  } catch {
    // Fallback without invalid timezone if failed
    return new Intl.DateTimeFormat(DEFAULT_LOCALE, intlOptions).format(resolvedDate)
  }
}

/**
 * Format numbers with locale-specific separators and notation.
 */
export function formatLocaleNumber(
  value: number,
  locale: LocaleCode = DEFAULT_LOCALE,
  options: NumberFormatOptions = {}
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '0'
  }

  const { decimals, notation = 'standard', ...intlOptions } = options

  const formatOptions: Intl.NumberFormatOptions = {
    notation,
    ...(decimals !== undefined
      ? {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }
      : {}),
    ...intlOptions,
  }

  try {
    return new Intl.NumberFormat(locale, formatOptions).format(value)
  } catch {
    return new Intl.NumberFormat(DEFAULT_LOCALE, formatOptions).format(value)
  }
}

/**
 * Format currencies with locale-specific symbols, placement, and codes.
 */
export function formatLocaleCurrency(
  value: number,
  currency = 'USD',
  locale: LocaleCode = DEFAULT_LOCALE,
  options: CurrencyFormatOptions = {}
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '$0'
  }

  const { decimals, display = 'symbol', ...intlOptions } = options

  const formatOptions: Intl.NumberFormatOptions = {
    style: 'currency',
    currency,
    currencyDisplay: display,
    ...(decimals !== undefined
      ? {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }
      : {}),
    ...intlOptions,
  }

  try {
    return new Intl.NumberFormat(locale, formatOptions).format(value)
  } catch {
    return new Intl.NumberFormat(DEFAULT_LOCALE, {
      ...formatOptions,
      currency: 'USD',
    }).format(value)
  }
}

/**
 * Format relative time using Intl.RelativeTimeFormat (e.g., "in 3 days", "il y a 2 heures").
 */
export function formatRelativeTime(
  value: number,
  unit: Intl.RelativeTimeFormatUnit = 'day',
  locale: LocaleCode = DEFAULT_LOCALE,
  options: Intl.RelativeTimeFormatOptions = { numeric: 'auto' }
): string {
  try {
    const rtf = new Intl.RelativeTimeFormat(locale, options)
    return rtf.format(value, unit)
  } catch {
    const rtf = new Intl.RelativeTimeFormat(DEFAULT_LOCALE, options)
    return rtf.format(value, unit)
  }
}
