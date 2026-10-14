import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DisclaimerBanner } from '@/components/compliance/DisclaimerBanner'
import { ScenarioPanel } from '@/components/modes/ScenarioPanel'
import { Legend } from '@/components/map/Legend'
import { ProvenanceBadge } from '@/components/risk/ProvenanceBadge'
import { ConfidenceBadge } from '@/components/risk/ConfidenceBadge'

describe('NEXSTORM UI Risk Components', () => {
  describe('DisclaimerBanner', () => {
    it('renders disclaimer banner with data-testid and mandatory research notice', () => {
      render(<DisclaimerBanner />)
      const banner = screen.getByTestId('disclaimer-banner')
      expect(banner).toBeDefined()
      expect(banner.textContent).toContain('Research Prototype')
      expect(banner.textContent).toContain('NEXSTORM provides experimental relative waterlogging risk estimates')
      expect(banner.textContent).toContain('DEMO DATA')
    })
  })

  describe('ScenarioPanel', () => {
    it('renders presets and triggers onChange when preset clicked', () => {
      const handleChange = vi.fn()
      render(
        <ScenarioPanel
          params={{ peakMm1h: 30, durationH: 4, antecedentMm72h: 20 }}
          onChange={handleChange}
        />
      )

      const presetBtn = screen.getByRole('button', { name: /Heavy 70mm-type/i })
      fireEvent.click(presetBtn)

      expect(handleChange).toHaveBeenCalledWith({
        peakMm1h: 45,
        durationH: 4,
        antecedentMm72h: 35,
      })
    })

    it('triggers onChange when peak rainfall slider is adjusted', () => {
      const handleChange = vi.fn()
      render(
        <ScenarioPanel
          params={{ peakMm1h: 30, durationH: 4, antecedentMm72h: 20 }}
          onChange={handleChange}
        />
      )

      const slider = screen.getByLabelText(/Peak 1-Hour Rainfall/i)
      fireEvent.change(slider, { target: { value: '65' } })

      expect(handleChange).toHaveBeenCalledWith({
        peakMm1h: 65,
        durationH: 4,
        antecedentMm72h: 20,
      })
    })
  })

  describe('Legend', () => {
    it('displays color-blind safe labels and class share coverage', () => {
      render(<Legend classShare={{ low: 0.5, moderate: 0.3, high: 0.2 }} />)
      expect(screen.getByTestId('map-legend')).toBeDefined()
      expect(screen.getByText(/High Risk \[HIGH\]/i)).toBeDefined()
      expect(screen.getByText(/Moderate Risk \[MOD\]/i)).toBeDefined()
      expect(screen.getByText(/Low Risk \[LOW\]/i)).toBeDefined()
      expect(screen.getByText('50%')).toBeDefined()
      expect(screen.getByText('30%')).toBeDefined()
      expect(screen.getByText('20%')).toBeDefined()
    })
  })

  describe('ProvenanceBadge', () => {
    it('renders DEMO DATA badge prominently', () => {
      render(
        <ProvenanceBadge
          provenance={[
            { kind: 'simulated', source: 'Test Hyetograph', note: 'DEMO DATA' },
          ]}
        />
      )
      expect(screen.getByTestId('demo-data-badge')).toBeDefined()
      expect(screen.getByText('Test Hyetograph')).toBeDefined()
    })
  })

  describe('ConfidenceBadge', () => {
    it('displays confidence unavailable for single scenario', () => {
      render(<ConfidenceBadge confidence="unavailable" memberCount={1} />)
      expect(screen.getByText(/Confidence Unavailable/i)).toBeDefined()
      expect(screen.getByText(/Single deterministic scenario/i)).toBeDefined()
    })
  })
})
