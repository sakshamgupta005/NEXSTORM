/**
 * Core type definitions for Internationalization (i18n) and Localization (l10n).
 */

export type LocaleCode = 'en' | 'es' | 'fr' | 'de' | 'ar' | string

export type TextDirection = 'ltr' | 'rtl'

export interface LocaleMeta {
  code: LocaleCode
  name: string
  nativeName: string
  direction: TextDirection
  defaultCurrency: string
  defaultTimezone?: string
  flag?: string
}

export type TranslationDictionary = {
  [key: string]: string | TranslationDictionary
}

export interface TranslationResources {
  [locale: string]: TranslationDictionary
}

export interface TranslationOptions {
  count?: number
  fallback?: string
  context?: string
  [param: string]: unknown
}

export interface DateFormatOptions extends Intl.DateTimeFormatOptions {
  timezone?: string
}

export interface NumberFormatOptions extends Intl.NumberFormatOptions {
  decimals?: number
  notation?: 'standard' | 'compact' | 'scientific' | 'engineering'
}

export interface CurrencyFormatOptions extends Intl.NumberFormatOptions {
  currency?: string
  decimals?: number
  display?: 'symbol' | 'narrowSymbol' | 'code' | 'name'
}

export interface I18nContextValue {
  locale: LocaleCode
  direction: TextDirection
  locales: LocaleMeta[]
  currentLocaleMeta: LocaleMeta
  setLocale: (locale: LocaleCode) => void
  t: (key: string, options?: TranslationOptions) => string
  formatDate: (date: Date | string | number, options?: DateFormatOptions) => string
  formatNumber: (value: number, options?: NumberFormatOptions) => string
  formatCurrency: (value: number, options?: CurrencyFormatOptions) => string
  formatRelativeTime: (value: number, unit: Intl.RelativeTimeFormatUnit) => string
}
