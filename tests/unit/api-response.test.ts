import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiSuccess, apiError } from '@/lib/api/response'

describe('Standardized API Responses', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('generates successful JSON response with custom status and request ID', async () => {
    const res = apiSuccess({ user: 'bob', role: 'admin' }, { status: 201, requestId: 'req_abc' })
    expect(res.status).toBe(201)
    expect(res.headers.get('x-request-id')).toBe('req_abc')

    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toEqual({ user: 'bob', role: 'admin' })
    expect(body.requestId).toBe('req_abc')
    expect(body.timestamp).toBeDefined()
  })

  it('generates error JSON response with custom code and details', async () => {
    const res = apiError('Invalid email format', {
      status: 400,
      code: 'VALIDATION_ERROR',
      details: [{ field: 'email', reason: 'Missing @' }],
      requestId: 'req_xyz',
    })

    expect(res.status).toBe(400)
    expect(res.headers.get('x-request-id')).toBe('req_xyz')

    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error.message).toBe('Invalid email format')
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.details).toEqual([{ field: 'email', reason: 'Missing @' }])
  })

  it('sanitizes 500 error messages in production to protect server internals', async () => {
    vi.stubEnv('NODE_ENV', 'production')

    const res = apiError('FATAL: relation "users" does not exist at postgres:5432', {
      status: 500,
      internalError: new Error('Postgres connection dead'),
    })

    const body = await res.json()
    expect(res.status).toBe(500)
    expect(body.success).toBe(false)
    expect(body.error.message).toBe('An unexpected server error occurred. Please try again later.')
    expect(body.error.message).not.toContain('postgres')

    vi.unstubAllEnvs()
  })
})
