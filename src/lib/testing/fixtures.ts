import { createTestFactory } from './mocks'

/**
 * Reusable Domain Entity Fixtures & Factories
 */

export interface TestUser {
  id: string
  email: string
  role: 'authenticated' | 'admin' | 'guest'
  name: string
  createdAt: string
}

export interface TestSession {
  accessToken: string
  refreshToken: string
  expiresAt: number
  user: TestUser
}

export interface TestWebhookPayload {
  id: string
  event: string
  timestamp: number
  data: Record<string, unknown>
}

export interface TestFileRecord {
  id: string
  bucket: string
  path: string
  contentType: string
  sizeBytes: number
  uploadedAt: string
}

export const createTestUser = createTestFactory<TestUser>(() => ({
  id: `usr_${Math.random().toString(36).slice(2, 10)}`,
  email: 'hacker@example.com',
  role: 'authenticated',
  name: 'Ada Lovelace',
  createdAt: '2026-01-01T00:00:00.000Z',
}))

export const createTestSession = createTestFactory<TestSession>(() => {
  const user = createTestUser()
  return {
    accessToken: `mock-jwt-token-${Math.random().toString(36).slice(2, 12)}`,
    refreshToken: `mock-refresh-${Math.random().toString(36).slice(2, 12)}`,
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    user,
  }
})

export const createTestWebhookPayload = createTestFactory<TestWebhookPayload>(() => ({
  id: `evt_${Math.random().toString(36).slice(2, 10)}`,
  event: 'payment.completed',
  timestamp: Math.floor(Date.now() / 1000),
  data: {
    amount: 5000,
    currency: 'USD',
    customerId: 'cus_12345',
  },
}))

export const createTestFileRecord = createTestFactory<TestFileRecord>(() => ({
  id: `file_${Math.random().toString(36).slice(2, 10)}`,
  bucket: 'exports',
  path: 'reports/summary-2026.pdf',
  contentType: 'application/pdf',
  sizeBytes: 1048576,
  uploadedAt: '2026-01-01T00:00:00.000Z',
}))
