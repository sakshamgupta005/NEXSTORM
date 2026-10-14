import { test, expect } from '@playwright/test'

test.describe('Amritsar City Dashboard & Scenario API Smoke Tests', () => {
  test('renders /city/amritsar with disclaimer, DEMO DATA badge, controls, and map grid paths', async ({
    page,
  }) => {
    await page.goto('/city/amritsar')

    // 1. The disclaimer is visible
    const disclaimer = page.getByTestId('disclaimer-banner')
    await expect(disclaimer).toBeVisible()
    await expect(disclaimer).toContainText(/Research Prototype/i)

    // 2. The DEMO DATA badge is visible
    const demoBadge = page.getByTestId('demo-data-badge').first()
    await expect(demoBadge).toBeVisible()
    await expect(demoBadge).toHaveText('DEMO DATA')

    // 3. The map container renders
    const mapContainer = page.getByTestId('leaflet-map-container')
    await expect(mapContainer).toBeVisible()

    // 4. At least 1,000 path elements or canvas rendering is present
    await expect.poll(async () => {
      return await page.locator('.leaflet-overlay-pane path').count()
    }, { timeout: 30000, intervals: [1000] }).toBeGreaterThanOrEqual(1000)

    const pathCount = await page.locator('path').count()
    expect(pathCount).toBeGreaterThanOrEqual(1000)

    // 5. Scenario panel and legend are visible
    await expect(page.getByText(/Rainfall Scenario Controls/i)).toBeVisible()
    await expect(page.getByTestId('map-legend')).toBeVisible()
  })

  test('POST /api/scenario returns HTTP 400 for invalid scenario input', async ({ request }) => {
    // Exceeds peakMm1h max 120
    const res = await request.post('/api/scenario', {
      data: {
        cityId: 'amritsar',
        peakMm1h: 999,
        durationH: 4,
        antecedentMm72h: 0,
      },
    })
    expect(res.status()).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })
})
