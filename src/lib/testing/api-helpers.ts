import { createHmac } from 'node:crypto'
import { z } from 'zod'
import type { MockRequestOptions } from './types'

/**
 * Creates a mock Web standard Request (compatible with Next.js App Router route handlers)
 */
export function createMockRequest(url = 'http://localhost:3000/api/resource', options: MockRequestOptions = {}): Request {
  const { method = 'GET', headers = {}, body, searchParams } = options

  const parsedUrl = new URL(url)
  if (searchParams) {
    for (const [key, val] of Object.entries(searchParams)) {
      parsedUrl.searchParams.set(key, val)
    }
  }

  const reqHeaders = new Headers(headers)
  let requestBody: string | undefined

  if (body !== undefined && method !== 'GET' && method !== 'HEAD') {
    if (typeof body === 'string') {
      requestBody = body
    } else {
      requestBody = JSON.stringify(body)
      if (!reqHeaders.has('content-type')) {
        reqHeaders.set('content-type', 'application/json')
      }
    }
  }

  return new Request(parsedUrl.toString(), {
    method,
    headers: reqHeaders,
    body: requestBody,
  })
}

/**
 * Validates an API Response object against status code, success payload flag, and optional Zod schema
 */
export async function assertApiResponse<T = unknown>(
  response: Response,
  options: {
    status?: number
    success?: boolean
    schema?: z.ZodType<T>
  } = {}
): Promise<{ status: number; ok: boolean; data: T }> {
  if (options.status !== undefined && response.status !== options.status) {
    throw new Error(
      `assertApiResponse failed: Expected status ${options.status}, got ${response.status}`
    )
  }

  const rawJson = (await response.json()) as Record<string, unknown> | null

  if (options.success !== undefined) {
    const actualSuccess = rawJson && typeof rawJson === 'object' ? rawJson.success : undefined
    if (actualSuccess !== options.success) {
      throw new Error(
        `assertApiResponse failed: Expected success=${options.success}, got ${actualSuccess}`
      )
    }
  }

  let finalData: unknown = rawJson && typeof rawJson === 'object' && rawJson.data !== undefined ? rawJson.data : rawJson

  if (options.schema) {
    const parseResult = options.schema.safeParse(finalData)
    if (!parseResult.success) {
      throw new Error(
        `assertApiResponse failed: Data failed schema validation: ${parseResult.error.message}`
      )
    }
    finalData = parseResult.data
  }

  return {
    status: response.status,
    ok: response.ok,
    data: finalData as T,
  }
}

/**
 * Generates an HMAC-SHA256 test webhook signature matching standard webhook provider formats (e.g. Stripe/Svix)
 */
export function generateMockWebhookSignature(
  payload: string | object,
  secret: string,
  timestamp: number = Math.floor(Date.now() / 1000)
): { signature: string; timestamp: number; header: string } {
  const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload)
  const signedContent = `${timestamp}.${payloadString}`
  const hmac = createHmac('sha256', secret)
  hmac.update(signedContent)
  const signature = hmac.digest('hex')

  return {
    signature,
    timestamp,
    header: `t=${timestamp},v1=${signature}`,
  }
}

/**
 * Asserts that executing an action multiple times yields identical idempotent results without side-effect drift
 */
export async function assertIdempotentExecution<T>(
  actionFn: () => Promise<T>,
  runs = 3
): Promise<{ results: T[]; isConsistent: boolean }> {
  if (runs < 2) throw new Error('Idempotency assertion requires at least 2 runs')

  const results: T[] = []
  for (let i = 0; i < runs; i++) {
    const res = await actionFn()
    results.push(res)
  }

  const firstSerialized = JSON.stringify(results[0])
  const isConsistent = results.every((r) => JSON.stringify(r) === firstSerialized)

  if (!isConsistent) {
    throw new Error(
      `assertIdempotentExecution failed: Output changed across ${runs} consecutive runs.`
    )
  }

  return {
    results,
    isConsistent: true,
  }
}
