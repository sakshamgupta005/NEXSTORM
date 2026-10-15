import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FrontendApp } from '@/components/home/FrontendApp'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useParams: () => ({ cityId: 'amritsar' }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/',
}))

// Mock leaflet canvas
vi.mock('@/components/home/BuildingMapCanvas', () => ({
  BuildingMapCanvas: () => <div data-testid="mock-building-map">Building Map Mock</div>,
}))

vi.mock('@/components/home/RoadMapCanvas', () => ({
  RoadMapCanvas: () => <div data-testid="mock-road-map">Road Map Mock</div>,
}))

describe('FRONTEND_FINAL1 Integrated Experience', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/health')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                status: 'healthy',
                uptimeSeconds: 120,
                version: '0.1.0',
                environment: { nodeEnv: 'test', supabaseConfigured: false, aiConfigured: false },
                checks: { serverClock: true, runtimeUptime: true, memoryUsageMb: 50 },
              },
            }),
        })
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: {} }),
      })
    })
  })

  it('renders NEXSTORM brand, hero title, and navigation tabs', () => {
    render(<FrontendApp />)

    expect(screen.getAllByText(/NEXSTORM/i)[0]).toBeDefined()
    expect(screen.getByText('URBAN RESILIENCE PLATFORM')).toBeDefined()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Urban Flood Risk/i)

    expect(screen.getAllByRole('button', { name: /^Overview$/i })[0]).toBeDefined()
    expect(screen.getAllByRole('button', { name: /^Buildings$/i })[0]).toBeDefined()
    expect(screen.getAllByRole('button', { name: /^Roads$/i })[0]).toBeDefined()
    expect(screen.getByRole('button', { name: /^About Us$/i })).toBeDefined()
  })

  it('navigates to Buildings tab and displays hotspot structures', async () => {
    render(<FrontendApp />)

    const buildingsTab = screen.getAllByRole('button', { name: /^Buildings$/i })[0]
    fireEvent.click(buildingsTab)

    expect(
      screen.getByRole('heading', { name: /Geospatial Building Exposure Map/i })
    ).toBeDefined()
    expect(screen.getAllByText(/Hall Gate Commercial Basin/i)[0]).toBeDefined()
    expect(screen.getByText(/Heritage Street & Golden Temple Axis/i)).toBeDefined()
    expect(screen.getByText(/Mall Road & Civil Lines/i)).toBeDefined()
    expect(screen.getByText(/Ranjit Avenue Sector D Complex/i)).toBeDefined()
  })

  it('navigates to Roads tab and displays route comparison options', async () => {
    render(<FrontendApp />)

    const roadsTab = screen.getAllByRole('button', { name: /^Roads$/i })[0]
    fireEvent.click(roadsTab)

    expect(
      screen.getByRole('heading', { name: /Dynamic Road Inundation & Routing Map/i })
    ).toBeDefined()
    expect(screen.getByText(/Route A: Amritsar Bypass Elevated Flyover/i)).toBeDefined()
    expect(screen.getByText(/Route B: GT Road via Rego Bridge Sump/i)).toBeDefined()
    expect(screen.getByText(/Rego Bridge Railway Underpass Sump/i)).toBeDefined()
  })

  it('navigates to About Us tab and displays 6-stage system pipeline', async () => {
    render(<FrontendApp />)

    const aboutTab = screen.getByRole('button', { name: /^About Us$/i })
    fireEvent.click(aboutTab)

    expect(
      screen.getByRole('heading', { name: /Scientific Urban Waterlogging Intelligence/i })
    ).toBeDefined()
    expect(screen.getByRole('heading', { name: /How NEXSTORM Works/i })).toBeDefined()
    expect(screen.getByText(/Satellite & Terrain Data Acquisition/i)).toBeDefined()
    expect(screen.getByText(/Topographic Depression Detection/i)).toBeDefined()
    expect(screen.getByText(/Real-Time Civic Intelligence Dashboard/i)).toBeDefined()
  })

  it('opens and loads real health diagnostics modal when clicking Live Pipeline Status', async () => {
    render(<FrontendApp />)

    const statusBtn = screen.getByRole('button', { name: /Live Pipeline Status/i })
    fireEvent.click(statusBtn)

    await waitFor(() => {
      expect(screen.getByText(/Live Pipeline & System Health Diagnostics/i)).toBeDefined()
      expect(screen.getByText(/Copernicus 30m DEM Elevation Grid/i)).toBeDefined()
      expect(screen.getByText(/ERA5 \/ Open-Meteo Precipitation Stream/i)).toBeDefined()
    })
  })
})
