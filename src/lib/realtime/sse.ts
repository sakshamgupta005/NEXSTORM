/**
 * Reusable Server-Sent Events (SSE) & Stream Consumption Helper
 * 
 * Capabilities:
 * - Robust line-by-line SSE parsing from ReadableStream
 * - Extraction of event, data, id, and retry directives
 * - AI streaming convention support (e.g. data: [DONE])
 * - AbortSignal cancellation support
 * - Headers, auth tokens, and HTTP error handling
 */

export interface SSEEvent {
  event: string
  data: string
  id?: string
  retry?: number
}

export interface SSEConsumerOptions extends Omit<RequestInit, 'signal'> {
  signal?: AbortSignal
  authToken?: string
  getAuthToken?: () => string | Promise<string | null>
  onEvent?: (event: SSEEvent) => void
  onChunk?: (chunk: string) => void
  onError?: (error: Error) => void
  onDone?: () => void
}

/**
 * Parses raw text buffer containing SSE chunks into discrete SSEEvent records
 */
export function parseSSEChunk(chunk: string): SSEEvent[] {
  const events: SSEEvent[] = []
  const blocks = chunk.split(/\r\n\r\n|\n\n/)

  for (const block of blocks) {
    if (!block.trim()) continue

    let eventType = 'message'
    const dataLines: string[] = []
    let id: string | undefined = undefined
    let retry: number | undefined = undefined

    const lines = block.split(/\r\n|\n/)
    for (const line of lines) {
      if (!line || line.startsWith(':')) {
        // Comment / keepalive ping, skip
        continue
      }

      if (line.startsWith('event:')) {
        const val = line.slice(6)
        eventType = val.startsWith(' ') ? val.slice(1) : val
      } else if (line.startsWith('data:')) {
        const val = line.slice(5)
        dataLines.push(val.startsWith(' ') ? val.slice(1) : val)
      } else if (line.startsWith('id:')) {
        const val = line.slice(3)
        id = (val.startsWith(' ') ? val.slice(1) : val).trim()
      } else if (line.startsWith('retry:')) {
        const val = parseInt(line.slice(6).trim(), 10)
        if (!isNaN(val)) retry = val
      }
    }

    if (dataLines.length > 0) {
      events.push({
        event: eventType,
        data: dataLines.join('\n'),
        id,
        retry,
      })
    }
  }

  return events
}

/**
 * Consumes an SSE HTTP endpoint using fetch and calls event handlers
 */
export async function consumeSSE(
  url: string,
  options: SSEConsumerOptions = {}
): Promise<void> {
  const {
    signal,
    authToken,
    getAuthToken,
    onEvent,
    onChunk,
    onError,
    onDone,
    headers = {},
    ...fetchInit
  } = options

  const reqHeaders = new Headers(headers)
  if (!reqHeaders.has('accept')) {
    reqHeaders.set('accept', 'text/event-stream')
  }

  let token = authToken
  if (!token && getAuthToken) {
    try {
      const resolved = await getAuthToken()
      if (resolved) token = resolved
    } catch {
      // ignore
    }
  }
  if (token && !reqHeaders.has('authorization')) {
    reqHeaders.set('authorization', `Bearer ${token}`)
  }

  try {
    const response = await fetch(url, {
      ...fetchInit,
      headers: reqHeaders,
      signal,
    })

    if (!response.ok) {
      let errBody = `HTTP ${response.status} ${response.statusText}`
      try {
        const text = await response.text()
        if (text) errBody = text.slice(0, 250)
      } catch {
        // ignore
      }
      throw new Error(`SSE Connection failed: ${errBody}`)
    }

    if (!response.body) {
      throw new Error('Response body is null or does not support streaming')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''

    while (true) {
      if (signal?.aborted) {
        break
      }

      const { done, value } = await reader.read()
      if (done) {
        break
      }

      const textChunk = decoder.decode(value, { stream: true })
      buffer += textChunk

      // Check if we have complete blocks separated by double newlines
      const splitIndex = Math.max(buffer.lastIndexOf('\n\n'), buffer.lastIndexOf('\r\n\r\n'))
      if (splitIndex !== -1) {
        const completeBlocks = buffer.slice(0, splitIndex)
        buffer = buffer.slice(splitIndex + 2) // keep remainder for next tick

        const events = parseSSEChunk(completeBlocks)
        for (const ev of events) {
          if (ev.data === '[DONE]') {
            onDone?.()
            return
          }
          onEvent?.(ev)
          onChunk?.(ev.data)
        }
      }
    }

    // Flush any remaining trailing buffer
    if (buffer.trim()) {
      const events = parseSSEChunk(buffer)
      for (const ev of events) {
        if (ev.data === '[DONE]') {
          onDone?.()
          return
        }
        onEvent?.(ev)
        onChunk?.(ev.data)
      }
    }

    onDone?.()
  } catch (err: unknown) {
    if (signal?.aborted) {
      onDone?.()
      return
    }
    const errorObj = err instanceof Error ? err : new Error(String(err))
    onError?.(errorObj)
    throw errorObj
  }
}
