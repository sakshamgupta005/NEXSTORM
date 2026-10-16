/**
 * Core Translator engine supporting nested keys, pluralization, and variable interpolation.
 */

import {
  LocaleCode,
  TranslationDictionary,
  TranslationOptions,
  TranslationResources,
} from './types'
import { DEFAULT_LOCALE, DEFAULT_TRANSLATIONS } from './locales'

export class Translator {
  private resources: TranslationResources
  private currentLocale: LocaleCode
  private defaultLocale: LocaleCode

  constructor(options: {
    resources?: TranslationResources
    defaultLocale?: LocaleCode
    currentLocale?: LocaleCode
  } = {}) {
    this.resources = options.resources || DEFAULT_TRANSLATIONS
    this.defaultLocale = options.defaultLocale || DEFAULT_LOCALE
    this.currentLocale = options.currentLocale || this.defaultLocale
  }

  public setLocale(locale: LocaleCode): void {
    this.currentLocale = locale
  }

  public getLocale(): LocaleCode {
    return this.currentLocale
  }

  public addResource(locale: LocaleCode, dictionary: TranslationDictionary): void {
    this.resources[locale] = {
      ...(this.resources[locale] || {}),
      ...dictionary,
    }
  }

  /**
   * Resolves a key into a translated string with pluralization and variable interpolation.
   */
  public t(key: string, options: TranslationOptions = {}): string {
    const { count, fallback, ...params } = options

    let resolvedPattern: string | null = null

    // 1. Pluralization check if count is present
    if (typeof count === 'number') {
      // Explicit zero check (standard in i18n libraries)
      if (count === 0) {
        resolvedPattern =
          this.lookupKey(this.currentLocale, `${key}.zero`) ??
          this.lookupKey(this.defaultLocale, `${key}.zero`)
      }

      if (!resolvedPattern) {
        const pluralCategory = this.getPluralCategory(this.currentLocale, count)
        const pluralKey = `${key}.${pluralCategory}`

        resolvedPattern =
          this.lookupKey(this.currentLocale, pluralKey) ??
          this.lookupKey(this.defaultLocale, pluralKey)

        // Fallback to 'other' plural if specific category was missing
        if (!resolvedPattern && pluralCategory !== 'other') {
          const otherKey = `${key}.other`
          resolvedPattern =
            this.lookupKey(this.currentLocale, otherKey) ??
            this.lookupKey(this.defaultLocale, otherKey)
        }
      }
    }

    // 2. Standard direct key lookup
    if (!resolvedPattern) {
      resolvedPattern =
        this.lookupKey(this.currentLocale, key) ??
        this.lookupKey(this.defaultLocale, key)
    }

    // 3. Fallback or key as last resort
    if (!resolvedPattern) {
      if (fallback !== undefined) return fallback
      return key
    }

    // 4. Interpolate variables (e.g. {{name}} or {name})
    return this.interpolate(resolvedPattern, { count, ...params })
  }

  /**
   * Traverses nested keys in dictionary (e.g. 'common.welcome').
   */
  private lookupKey(locale: LocaleCode, key: string): string | null {
    const dict = this.resources[locale]
    if (!dict) return null

    const segments = key.split('.')
    let current: unknown = dict

    for (const segment of segments) {
      if (!current || typeof current !== 'object') {
        return null
      }
      current = (current as Record<string, unknown>)[segment]
    }

    return typeof current === 'string' ? current : null
  }

  /**
   * Derives plural form using standard Intl.PluralRules.
   */
  private getPluralCategory(locale: LocaleCode, count: number): string {
    try {
      const pr = new Intl.PluralRules(locale)
      return pr.select(count)
    } catch {
      return count === 1 ? 'one' : 'other'
    }
  }

  /**
   * Interpolates {{variable}} and {variable} placeholders.
   */
  private interpolate(pattern: string, params: Record<string, unknown>): string {
    return pattern.replace(/(?:\{\{|\{)([\w.-]+)(?:\}\}|\})/g, (match, paramName) => {
      const val = params[paramName]
      if (val === undefined || val === null) {
        return match
      }
      return String(val)
    })
  }
}
