'use client'

import * as React from 'react'
import {
  CurrencyFormatOptions,
  DateFormatOptions,
  I18nContextValue,
  LocaleCode,
  LocaleMeta,
  NumberFormatOptions,
  TextDirection,
  TranslationOptions,
  TranslationResources,
} from './types'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, DEFAULT_TRANSLATIONS } from './locales'
import { Translator } from './translator'
import {
  formatLocaleCurrency,
  formatLocaleDate,
  formatLocaleNumber,
  formatRelativeTime,
} from './formatters'

const LOCALE_STORAGE_KEY = 'hackathon_locale_preference'

const I18nContext = React.createContext<I18nContextValue | null>(null)

export interface I18nProviderProps {
  children: React.ReactNode
  initialLocale?: LocaleCode
  locales?: LocaleMeta[]
  resources?: TranslationResources
}

export function I18nProvider({
  children,
  initialLocale = DEFAULT_LOCALE,
  locales = SUPPORTED_LOCALES,
  resources = DEFAULT_TRANSLATIONS,
}: I18nProviderProps) {
  const [locale, setLocaleState] = React.useState<LocaleCode>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(LOCALE_STORAGE_KEY)
        if (saved && locales.some((l) => l.code === saved)) {
          return saved
        }
      } catch {
        // Storage access restricted or unavailable
      }
    }
    return initialLocale
  })

  // Initialize translator
  const translator = React.useMemo(() => {
    return new Translator({
      resources,
      defaultLocale: DEFAULT_LOCALE,
      currentLocale: locale,
    })
  }, [resources, locale])

  // Resolve active locale metadata
  const currentLocaleMeta = React.useMemo(() => {
    return (
      locales.find((l) => l.code === locale) ||
      locales.find((l) => l.code === DEFAULT_LOCALE) ||
      locales[0]
    )
  }, [locale, locales])

  const direction: TextDirection = currentLocaleMeta.direction

  // Apply HTML lang and dir attributes to document root
  React.useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale
      document.documentElement.dir = direction
    }
  }, [locale, direction])

  const setLocale = React.useCallback(
    (newLocale: LocaleCode) => {
      setLocaleState(newLocale)
      try {
        localStorage.setItem(LOCALE_STORAGE_KEY, newLocale)
      } catch {
        // Storage unavailable
      }
    },
    []
  )

  const t = React.useCallback(
    (key: string, options?: TranslationOptions) => {
      return translator.t(key, options)
    },
    [translator]
  )

  const formatDate = React.useCallback(
    (date: Date | string | number, options?: DateFormatOptions) => {
      return formatLocaleDate(date, locale, {
        timezone: currentLocaleMeta.defaultTimezone,
        ...options,
      })
    },
    [locale, currentLocaleMeta.defaultTimezone]
  )

  const formatNumber = React.useCallback(
    (value: number, options?: NumberFormatOptions) => {
      return formatLocaleNumber(value, locale, options)
    },
    [locale]
  )

  const formatCurrency = React.useCallback(
    (value: number, options?: CurrencyFormatOptions) => {
      return formatLocaleCurrency(
        value,
        options?.currency || currentLocaleMeta.defaultCurrency,
        locale,
        options
      )
    },
    [locale, currentLocaleMeta.defaultCurrency]
  )

  const formatRelTime = React.useCallback(
    (value: number, unit: Intl.RelativeTimeFormatUnit) => {
      return formatRelativeTime(value, unit, locale)
    },
    [locale]
  )

  const contextValue: I18nContextValue = React.useMemo(
    () => ({
      locale,
      direction,
      locales,
      currentLocaleMeta,
      setLocale,
      t,
      formatDate,
      formatNumber,
      formatCurrency,
      formatRelativeTime: formatRelTime,
    }),
    [
      locale,
      direction,
      locales,
      currentLocaleMeta,
      setLocale,
      t,
      formatDate,
      formatNumber,
      formatCurrency,
      formatRelTime,
    ]
  )

  return <I18nContext.Provider value={contextValue}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const context = React.useContext(I18nContext)
  if (!context) {
    // Graceful fallback if rendered outside provider
    const fallbackTranslator = new Translator()
    return {
      locale: DEFAULT_LOCALE,
      direction: 'ltr',
      locales: SUPPORTED_LOCALES,
      currentLocaleMeta: SUPPORTED_LOCALES[0],
      setLocale: () => {},
      t: (key, opts) => fallbackTranslator.t(key, opts),
      formatDate: (d, opts) => formatLocaleDate(d, DEFAULT_LOCALE, opts),
      formatNumber: (n, opts) => formatLocaleNumber(n, DEFAULT_LOCALE, opts),
      formatCurrency: (c, opts) => formatLocaleCurrency(c, 'USD', DEFAULT_LOCALE, opts),
      formatRelativeTime: (v, u) => formatRelativeTime(v, u, DEFAULT_LOCALE),
    }
  }
  return context
}

export const useTranslation = useI18n
