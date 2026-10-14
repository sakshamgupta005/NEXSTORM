/**
 * Reusable HTTP API Test Fixtures & Mocks
 * 
 * Provides deterministic Response objects for mocking fetch across unit & integration tests.
 */

export function createMockJsonResponse(
  data: unknown,
  options: { status?: number; headers?: Record<string, string> } = {}
): Response {
  const { status = 200, headers = {} } = options
  const responseHeaders = new Headers({
    'content-type': 'application/json',
    ...headers,
  })

  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: responseHeaders,
    json: async () => data,
    text: async () => JSON.stringify(data),
    clone: () => createMockJsonResponse(data, options),
  } as unknown as Response
}

export function createMockErrorResponse(
  status: number,
  errorMessage: string,
  headers: Record<string, string> = {}
): Response {
  const responseHeaders = new Headers({
    'content-type': 'text/plain',
    ...headers,
  })

  return {
    ok: false,
    status,
    statusText: `HTTP Error ${status}`,
    headers: responseHeaders,
    json: async () => ({ error: errorMessage }),
    text: async () => errorMessage,
    clone: () => createMockErrorResponse(status, errorMessage, headers),
  } as unknown as Response
}
