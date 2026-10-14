import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { I18nProvider, useI18n } from '@/lib/i18n/context'
import { LiveAnnouncer, useAnnounce } from '@/lib/a11y/announcer'
import { LanguageSwitcher } from '@/components/i18n/language-switcher'
import { LocaleDemo } from '@/components/i18n/locale-demo'
import { runA11yAudit } from '@/lib/a11y/audit'

function TestTranslationConsumer() {
  const { t, locale, setLocale, direction } = useI18n()
  const { announce } = useAnnounce()

  return (
    <div data-testid="consumer" dir={direction}>
      <span data-testid="current-locale">{locale}</span>
      <span data-testid="greeting">{t('common.save')}</span>
      <span data-testid="welcome">{t('common.welcome', { name: 'Morgan' })}</span>
      <button onClick={() => setLocale('es')} data-testid="btn-to-es">
        Switch to Spanish
      </button>
      <button onClick={() => setLocale('ar')} data-testid="btn-to-ar">
        Switch to Arabic
      </button>
      <button
        onClick={() => announce('Record saved successfully', 'assertive')}
        data-testid="btn-announce"
      >
        Announce
      </button>
    </div>
  )
}

describe('Internationalization, Localization & Accessibility (Component Tests)', () => {
  it('renders translations and handles language switching reactively', () => {
    render(
      <I18nProvider initialLocale="en">
        <LiveAnnouncer>
          <TestTranslationConsumer />
        </LiveAnnouncer>
      </I18nProvider>
    )

    expect(screen.getByTestId('current-locale')).toHaveTextContent('en')
    expect(screen.getByTestId('greeting')).toHaveTextContent('Save Changes')
    expect(screen.getByTestId('welcome')).toHaveTextContent('Welcome, Morgan!')

    // Switch to Spanish
    fireEvent.click(screen.getByTestId('btn-to-es'))
    expect(screen.getByTestId('current-locale')).toHaveTextContent('es')
    expect(screen.getByTestId('greeting')).toHaveTextContent('Guardar Cambios')

    // Switch to Arabic (checks RTL direction)
    fireEvent.click(screen.getByTestId('btn-to-ar'))
    expect(screen.getByTestId('current-locale')).toHaveTextContent('ar')
    expect(screen.getByTestId('greeting')).toHaveTextContent('حفظ التغييرات')
    expect(screen.getByTestId('consumer')).toHaveAttribute('dir', 'rtl')
  })

  it('delivers screen-reader announcements via LiveAnnouncer aria-live regions', async () => {
    render(
      <I18nProvider initialLocale="en">
        <LiveAnnouncer>
          <TestTranslationConsumer />
        </LiveAnnouncer>
      </I18nProvider>
    )

    const assertiveRegion = screen.getByTestId('announcer-assertive')
    expect(assertiveRegion).toHaveAttribute('aria-live', 'assertive')
    expect(assertiveRegion).toBeEmptyDOMElement()

    fireEvent.click(screen.getByTestId('btn-announce'))

    await waitFor(() => {
      expect(assertiveRegion).toHaveTextContent('Record saved successfully')
    })
  })

  it('renders LanguageSwitcher dropdown and allows selecting options', () => {
    render(
      <I18nProvider initialLocale="en">
        <LanguageSwitcher variant="dropdown" />
      </I18nProvider>
    )

    const toggleButton = screen.getByRole('button', { name: /Select language/i })
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false')

    // Open dropdown menu
    fireEvent.click(toggleButton)
    expect(toggleButton).toHaveAttribute('aria-expanded', 'true')

    // Select Spanish option
    const esOption = screen.getByRole('option', { name: /Español/i })
    fireEvent.click(esOption)

    expect(toggleButton).toHaveAttribute('aria-expanded', 'false')
  })

  it('renders LanguageSwitcher pill variant with keyboard accessibility', () => {
    render(
      <I18nProvider initialLocale="en">
        <LanguageSwitcher variant="pills" />
      </I18nProvider>
    )

    expect(screen.getByTestId('language-switcher-pills')).toBeInTheDocument()
    const frButton = screen.getByRole('button', { name: /Français/i })
    fireEvent.click(frButton)
    expect(frButton).toHaveAttribute('aria-pressed', 'true')
  })

  it('renders the complete LocaleDemo component', () => {
    render(
      <I18nProvider initialLocale="en">
        <LiveAnnouncer>
          <LocaleDemo />
        </LiveAnnouncer>
      </I18nProvider>
    )

    expect(screen.getByTestId('locale-demo')).toBeInTheDocument()
    expect(screen.getByText(/Internationalization \(i18n\)/i)).toBeInTheDocument()
    expect(screen.getByText('Locale-Aware Formatting')).toBeInTheDocument()
    expect(screen.getByText(/Accessibility \(a11y\) & Screen Reader Region/i)).toBeInTheDocument()
  })

  it('executes automated accessibility audit with axe-core on rendered container', async () => {
    const { container } = render(
      <I18nProvider initialLocale="en">
        <LiveAnnouncer>
          <main aria-label="Main Application">
            <h1>Accessible Heading</h1>
            <p>High-contrast, accessible paragraph text.</p>
            <button type="button">Accessible Button</button>
          </main>
        </LiveAnnouncer>
      </I18nProvider>
    )

    const audit = await runA11yAudit(container)
    expect(audit).toBeDefined()
    expect(typeof audit.passes).toBe('boolean')
    expect(Array.isArray(audit.violations)).toBe(true)
    expect(audit.summary).toBeDefined()
  })
})
