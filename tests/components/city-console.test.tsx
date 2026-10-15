import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ModeSwitch } from '@/components/modes/ModeSwitch'
import { RainfallTimeline } from '@/components/console/RainfallTimeline'
import { RiskSummaryCards } from '@/components/console/RiskSummaryCards'
import { CellDetailPanel } from '@/components/console/CellDetailPanel'
import { OfficialAlertsPanel } from '@/components/console/OfficialAlertsPanel'
import { PunjabOverview } from '@/components/console/PunjabOverview'
import { MethodologySection } from '@/components/console/MethodologySection'
import type { TimelineHour } from '@/lib/risk/types'

describe('P6 City Console Components', () => {
  describe('ModeSwitch', () => {
    it('renders all three modes and triggers onChange when clicked', () => {
      const handleChange = vi.fn()
      render(<ModeSwitch mode="scenario" onChange={handleChange} />)

      expect(screen.getByRole('radio', { name: /Scenario Simulation/i })).toBeDefined()
      expect(screen.getByRole('radio', { name: /Live Forecast/i })).toBeDefined()
      expect(screen.getByRole('radio', { name: /Historical Replay/i })).toBeDefined()

      fireEvent.click(screen.getByRole('radio', { name: /Live Forecast/i }))
      expect(handleChange).toHaveBeenCalledWith('live')

      fireEvent.click(screen.getByRole('radio', { name: /Historical Replay/i }))
      expect(handleChange).toHaveBeenCalledWith('replay')
    })
  })

  describe('RainfallTimeline', () => {
    const mockTimeline: TimelineHour[] = [
      {
        hourIndex: 0,
        timestamp: '+0h',
        rtiP10: 0.2,
        rtiP50: 0.45,
        rtiP90: 0.6,
        band: 'none',
        classShare: { low: 0.9, moderate: 0.1, high: 0 },
      },
      {
        hourIndex: 1,
        timestamp: '+1h',
        rtiP10: 0.8,
        rtiP50: 1.25,
        rtiP90: 1.6,
        band: 'elevated',
        classShare: { low: 0.2, moderate: 0.5, high: 0.3 },
      },
      {
        hourIndex: 2,
        timestamp: '+2h',
        rtiP10: 1.5,
        rtiP50: 2.35,
        rtiP90: 2.8,
        band: 'extreme',
        classShare: { low: 0.05, moderate: 0.25, high: 0.7 },
      },
    ]

    it('renders timeline hour metrics and triggers onSelectHour', () => {
      const handleSelect = vi.fn()
      render(
        <RainfallTimeline
          timeline={mockTimeline}
          rainfallValues={[10.5, 35.0, 55.2]}
          selectedHourIndex={1}
          onSelectHour={handleSelect}
        />
      )

      expect(screen.getByText('35.0 mm')).toBeDefined()
      expect(screen.getByText('1.250')).toBeDefined()
      expect(screen.getByText(/t=1 \(ELEVATED\)/i)).toBeDefined()

      // Click previous hour button
      const prevBtn = screen.getByTitle('Previous Hour')
      fireEvent.click(prevBtn)
      expect(handleSelect).toHaveBeenCalledWith(0)
    })

    it('renders beyond calibration warning banner when flagged', () => {
      render(
        <RainfallTimeline
          timeline={mockTimeline}
          selectedHourIndex={2}
          onSelectHour={vi.fn()}
          beyondCalibration={true}
          beyondCalibrationReason="Max RTI 2.35 exceeds 1.5x extreme threshold."
        />
      )

      expect(screen.getByRole('alert')).toBeDefined()
      expect(screen.getByText(/Beyond Scientific Calibration/i)).toBeDefined()
      expect(screen.getByText(/Max RTI 2.35 exceeds 1.5x extreme threshold/i)).toBeDefined()
    })
  })

  describe('RiskSummaryCards', () => {
    it('renders evaluated grid cell counts and class distribution percentages', () => {
      render(
        <RiskSummaryCards
          totalCells={1998}
          classDistribution={{ low: 1200, moderate: 500, high: 298 }}
          classShare={{ low: 0.6, moderate: 0.25, high: 0.15 }}
          rainfallSummary={{ max1h: 45, max24h: 110, maxRti: 1.45 }}
          rtiBand="elevated"
          confidence="unavailable"
          memberCount={1}
          mode="scenario"
        />
      )

      expect(screen.getByText('298')).toBeDefined()
      expect(screen.getByText('(15%)')).toBeDefined()
      expect(screen.getByText(/1,998 evaluated cells/i)).toBeDefined()
      expect(screen.getByText('45')).toBeDefined()
      expect(screen.getByText(/110 mm/i)).toBeDefined()
      expect(screen.getByText('1.45')).toBeDefined()
      expect(screen.getByText('elevated')).toBeDefined()
    })
  })

  describe('CellDetailPanel', () => {
    beforeEach(() => {
      vi.restoreAllMocks()
    })

    it('renders empty prompt when cellId is null', () => {
      render(<CellDetailPanel cellId={null} onClose={vi.fn()} />)
      expect(screen.getByText(/Cell Inspector/i)).toBeDefined()
      expect(screen.getByText(/Click any 250m city cell or 50m campus sub-cell/i)).toBeDefined()
    })

    it('fetches and displays cell factor contributions and nearby hotspot', async () => {
      const mockExplanation = {
        cellId: 'A-0590',
        cityId: 'amritsar',
        sValue: 0.725,
        sBand: 'high',
        nearestRoad: 'Mall Road',
        factorContributions: [
          { factor: 'depression', label: 'Lower than surroundings', featureValue: 0.9, appliedWeight: 0.35, contribution: 0.315 },
          { factor: 'builtUp', label: 'Dense built-up area', featureValue: 0.8, appliedWeight: 0.15, contribution: 0.12 },
        ],
        terrainOverride: { applied: false, reason: 'Normal relief variance' },
        nearbyHotspot: {
          id: 'H-0001',
          name: 'SSSS Chowk Railway Underpass',
          distanceMeters: 120,
          articleDate: '2023-07-09',
          sourceUrl: 'https://example.com/ssss-chowk',
          evidence: 'news_report',
          precision: 'intersection',
        },
        limitations: ['Coarse rainfall input.', 'Proxy susceptibility.'],
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: mockExplanation }),
      })

      render(
        <CellDetailPanel
          cellId="A-0590"
          cityId="amritsar"
          cellRisk={{ id: 'A-0590', s: 0.725, class: 'high', p: { low: 0, moderate: 0.2, high: 0.8 }, confidence: 'unavailable' }}
          onClose={vi.fn()}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('#')).toBeDefined()
        expect(screen.getByText('A-0590')).toBeDefined()
      })

      expect(screen.getByText('HIGH')).toBeDefined()
      expect(screen.getByText(/0.7250 \(HIGH\)/i)).toBeDefined()
      expect(screen.getByText(/Mall Road/i)).toBeDefined()
      expect(screen.getByText('Lower than surroundings')).toBeDefined()
      expect(screen.getByText('SSSS Chowk Railway Underpass')).toBeDefined()
      expect(screen.getByText('120m away')).toBeDefined()
    })
  })

  describe('OfficialAlertsPanel', () => {
    beforeEach(() => {
      vi.restoreAllMocks()
    })

    it('renders empty state when no official warnings exist', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            status: 'ok',
            alerts: [],
            provenance: { kind: 'official', source: 'NDMA SACHET' },
          },
        }),
      })

      render(<OfficialAlertsPanel />)

      await waitFor(() => {
        expect(screen.getByText(/No Active Weather Warnings/i)).toBeDefined()
      })
      expect(screen.getAllByText(/NDMA SACHET CAP/i).length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText(/Statutory Authority Distinction/i)).toBeDefined()
    })

    it('renders active official alerts with links and metadata', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            status: 'ok',
            alerts: [
              {
                id: 'ALERT-001',
                event: 'Heavy Rain & Pluvial Waterlogging Warning',
                severity: 'Severe',
                areaDescription: 'Amritsar and Gurdaspur districts',
                effective: '2026-10-15T06:00:00Z',
                expires: '2026-10-16T18:00:00Z',
                link: 'https://sachet.ndma.gov.in/bulletin/001',
                author: 'IMD Chandigarh Regional Centre',
              },
            ],
            provenance: { kind: 'official', source: 'NDMA SACHET' },
          },
        }),
      })

      render(<OfficialAlertsPanel />)

      await waitFor(() => {
        expect(screen.getByText('Heavy Rain & Pluvial Waterlogging Warning')).toBeDefined()
      })
      expect(screen.getByText('Severe')).toBeDefined()
      expect(screen.getByText(/Amritsar and Gurdaspur districts/i)).toBeDefined()
      expect(screen.getByRole('link', { name: /Official Source Bulletin/i })).toBeDefined()
    })
  })

  describe('PunjabOverview', () => {
    it('renders geographic coverage tiers with Amritsar pilot boundary', () => {
      render(<PunjabOverview />)
      expect(screen.getByText(/Punjab Regional Scope & Pilot Boundary/i)).toBeDefined()
      expect(screen.getByText(/Geographic Boundary Enforcement/i)).toBeDefined()
      expect(screen.getByText(/Tier 1: Operational Pilot/i)).toBeDefined()
      expect(screen.getByText(/1,998 city cells \(250m\) \+ 699 GNDU cells \(50m\)/i)).toBeDefined()
      expect(screen.getByText(/Tier 2: Candidate Cities/i)).toBeDefined()
      expect(screen.getByText(/Ludhiana, Jalandhar, Patiala, Bathinda, Mohali/i)).toBeDefined()
    })
  })

  describe('MethodologySection', () => {
    it('renders permanent disclaimer, RTI formulation, and explicit non-claims', () => {
      render(<MethodologySection />)
      expect(screen.getByText(/Research Prototype Notice/i)).toBeDefined()
      expect(screen.getByText(/Experimental research prototype. Not an official weather forecast/i)).toBeDefined()
      expect(screen.getByText(/1. Multi-Window Rainfall Threat Index \(RTI\)/i)).toBeDefined()
      expect(screen.getByText(/2. Static Susceptibility Index \(s\)/i)).toBeDefined()
      expect(screen.getByText(/Explicit Scientific Boundaries/i)).toBeDefined()
      expect(screen.getByText(/Does NOT measure or predict street flood depth in centimeters/i)).toBeDefined()
      expect(screen.getByText(/Does NOT model underground stormwater or sanitary sewer pipe surcharge hydraulics/i)).toBeDefined()
      expect(screen.getByRole('link', { name: /Evaluation Metrics API/i })).toBeDefined()
    })
  })
})
