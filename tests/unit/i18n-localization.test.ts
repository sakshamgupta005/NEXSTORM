import { describe, it, expect } from 'vitest'
import {
  Translator,
  formatLocaleDate,
  formatLocaleNumber,
  formatLocaleCurrency,
  formatRelativeTime,
  SUPPORTED_LOCALES,
  DEFAULT_TRANSLATIONS,
} from '@/lib/i18n'
import { getFocusableElements, trapFocus } from '@/lib/a11y/focus'

describe('Internationalization, Localization & Accessibility (Unit Tests)', () => {
  describe('Translator Core', () => {
    it('translates direct and nested keys', () => {
      const translator = new Translator({ resources: DEFAULT_TRANSLATIONS, currentLocale: 'en' })
      expect(translator.t('common.save')).toBe('Save Changes')
      expect(translator.t('analytics.title')).toBe('Metrics & Performance')
    })

    it('interpolates variables with {{param}} and {param}', () => {
      const translator = new Translator({ resources: DEFAULT_TRANSLATIONS, currentLocale: 'en' })
      expect(translator.t('common.welcome', { name: 'Taylor' })).toBe('Welcome, Taylor!')

      translator.addResource('en', { custom: 'Hello, {user} from {city}!' })
      expect(translator.t('custom', { user: 'Jordan', city: 'Berlin' })).toBe('Hello, Jordan from Berlin!')
    })

    it('handles pluralization rules (zero, one, other)', () => {
      const translator = new Translator({ resources: DEFAULT_TRANSLATIONS, currentLocale: 'en' })
      expect(translator.t('items', { count: 0 })).toBe('No tasks pending')
      expect(translator.t('items', { count: 1 })).toBe('1 task pending')
      expect(translator.t('items', { count: 5 })).toBe('5 tasks pending')
    })

    it('falls back to default locale when key is missing in active locale', () => {
      const customResources = {
        en: { test: { greeting: 'Hello' } },
        es: { test: {} },
      }
      const translator = new Translator({
        resources: customResources,
        defaultLocale: 'en',
        currentLocale: 'es',
      })
      expect(translator.t('test.greeting')).toBe('Hello')
    })

    it('handles missing keys gracefully with fallback or raw key', () => {
      const translator = new Translator()
      expect(translator.t('missing.key')).toBe('missing.key')
      expect(translator.t('missing.key', { fallback: 'Default Fallback' })).toBe('Default Fallback')
    })

    it('supports dynamic language switching', () => {
      const translator = new Translator({ resources: DEFAULT_TRANSLATIONS, currentLocale: 'en' })
      expect(translator.t('common.save')).toBe('Save Changes')

      translator.setLocale('es')
      expect(translator.t('common.save')).toBe('Guardar Cambios')

      translator.setLocale('fr')
      expect(translator.t('common.save')).toBe('Enregistrer les modifications')

      translator.setLocale('de')
      expect(translator.t('common.save')).toBe('Änderungen speichern')

      translator.setLocale('ar')
      expect(translator.t('common.save')).toBe('حفظ التغييرات')
    })
  })

  describe('Locale-Aware Formatters', () => {
    describe('formatLocaleDate', () => {
      it('formats dates according to target locale', () => {
        const d = new Date('2026-10-12T12:00:00Z')
        const enDate = formatLocaleDate(d, 'en', { timezone: 'UTC' })
        const esDate = formatLocaleDate(d, 'es', { timezone: 'UTC' })
        expect(enDate).toMatch(/Oct 12, 2026/)
        expect(esDate).toMatch(/12 oct 2026|12 de oct/)
      })

      it('respects timezone parameter', () => {
        const d = new Date('2026-10-12T01:00:00Z')
        const nyDate = formatLocaleDate(d, 'en', {
          timezone: 'America/New_York',
          hour: '2-digit',
          minute: '2-digit',
        })
        expect(nyDate).toBeDefined()
      })

      it('handles invalid dates cleanly', () => {
        expect(formatLocaleDate('invalid-date')).toBe('invalid-date')
        expect(formatLocaleDate('')).toBe('')
      })
    })

    describe('formatLocaleNumber', () => {
      it('formats numbers with locale digit grouping', () => {
        expect(formatLocaleNumber(1250000, 'en')).toBe('1,250,000')
        expect(formatLocaleNumber(1250000, 'de')).toMatch(/1\.250\.000/)
      })

      it('supports compact notation and decimals', () => {
        expect(formatLocaleNumber(2500000, 'en', { notation: 'compact' })).toMatch(/2\.5M/)
      })

      it('handles edge cases', () => {
        expect(formatLocaleNumber(0)).toBe('0')
        // @ts-expect-error invalid input test
        expect(formatLocaleNumber(null)).toBe('0')
      })
    })

    describe('formatLocaleCurrency', () => {
      it('formats currencies with proper symbols and placement', () => {
        const usdEn = formatLocaleCurrency(500, 'USD', 'en')
        expect(usdEn).toBe('$500.00')

        const eurDe = formatLocaleCurrency(500, 'EUR', 'de')
        expect(eurDe).toMatch(/500,00\s?€/)

        const aedAr = formatLocaleCurrency(500, 'AED', 'ar')
        expect(aedAr).toBeDefined()
      })
    })

    describe('formatRelativeTime', () => {
      it('formats relative durations', () => {
        expect(formatRelativeTime(-1, 'day', 'en')).toMatch(/yesterday|1 day ago/)
        expect(formatRelativeTime(1, 'day', 'en')).toMatch(/tomorrow|in 1 day/)
      })
    })
  })

  describe('Locale Metadata & Direction', () => {
    it('identifies RTL direction for Arabic and LTR for others', () => {
      const arMeta = SUPPORTED_LOCALES.find((l) => l.code === 'ar')
      expect(arMeta?.direction).toBe('rtl')

      const enMeta = SUPPORTED_LOCALES.find((l) => l.code === 'en')
      expect(enMeta?.direction).toBe('ltr')

      const esMeta = SUPPORTED_LOCALES.find((l) => l.code === 'es')
      expect(esMeta?.direction).toBe('ltr')
    })
  })

  describe('Focus Management & TrapFocus', () => {
    it('extracts all focusable elements within a container', () => {
      const container = document.createElement('div')
      container.innerHTML = `
        <button id="btn1">Button 1</button>
        <a href="#link" id="link1">Link</a>
        <input type="text" id="input1" />
        <button disabled id="disabledBtn">Disabled</button>
        <div tabindex="-1">Hidden focus</div>
        <button id="btn2">Button 2</button>
      `
      document.body.appendChild(container)

      const focusables = getFocusableElements(container)
      expect(focusables.map((el) => el.id)).toEqual(['btn1', 'link1', 'input1', 'btn2'])

      document.body.removeChild(container)
    })

    it('traps focus correctly on Tab and Shift+Tab', () => {
      const container = document.createElement('div')
      container.innerHTML = `
        <button id="first">First</button>
        <button id="last">Last</button>
      `
      document.body.appendChild(container)

      const firstBtn = container.querySelector('#first') as HTMLElement
      const lastBtn = container.querySelector('#last') as HTMLElement

      // Forward wrap from last to first
      lastBtn.focus()
      const forwardTabEvent = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: false })
      trapFocus(container, forwardTabEvent)
      expect(document.activeElement).toBe(firstBtn)

      // Backward wrap from first to last
      firstBtn.focus()
      const backwardTabEvent = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true })
      trapFocus(container, backwardTabEvent)
      expect(document.activeElement).toBe(lastBtn)

      document.body.removeChild(container)
    })
  })
})
