import { test, expect } from '@playwright/test'

test.describe('Hackathon Starter Smoke Tests', () => {
  test('Landing page renders properly with key sections and CTAs', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/NEXSTORM|Hackathon Starter/i)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      /Urban Flood Risk|Hackathon Starter Foundation/i
    )
    await expect(page.getByRole('link', { name: /sign in/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /sign up/i }).first()).toBeVisible()
  })

  test('Login route loads login card and handles invalid input', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible()
    await expect(page.getByLabel(/email address/i)).toBeVisible()
    await expect(page.getByLabel(/password/i)).toBeVisible()

    // Test form validation interaction
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page.getByText(/valid email/i)).toBeVisible()
  })

  test('Signup route loads registration card and verifies password mismatch validation', async ({ page }) => {
    await page.goto('/signup')
    await expect(page.getByRole('heading', { name: /create an account/i })).toBeVisible()

    await page.getByLabel(/email address/i).fill('hacker@dev.io')
    await page.getByLabel(/^password/i).fill('password123')
    await page.getByLabel(/confirm password/i).fill('mismatch456')
    await page.getByRole('button', { name: /create account/i }).click()

    await expect(page.getByText(/passwords do not match/i)).toBeVisible()
  })

  test('Not-found page handles arbitrary missing routes cleanly', async ({ page }) => {
    await page.goto('/non-existent-subpath-test')
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/404/i)
    await expect(page.getByRole('link', { name: /back to home/i })).toBeVisible()
  })

  test('Dashboard loads in development preview mode with setup notice', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { name: /application workspace/i })).toBeVisible()
    await expect(
      page.getByRole('heading', { name: /welcome to your hackathon workspace/i })
    ).toBeVisible()
    await expect(page.getByText(/product workspace extension point/i)).toBeVisible()
  })

  test('Health probe /api/health responds with 200 JSON payload', async ({ request }) => {
    const response = await request.get('/api/health')
    expect(response.status()).toBe(200)

    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.data.status).toBe('healthy')
    expect(data.data.uptimeSeconds).toBeGreaterThanOrEqual(0)
    expect(data.requestId).toBeDefined()
  })
})
