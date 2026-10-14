import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { createWebSocketClient } from '@/lib/realtime/websocket'
import { parseSSEChunk, consumeSSE } from '@/lib/realtime/sse'
import { useWebSocket } from '@/hooks/use-websocket'
import { useRealtimeStream } from '@/hooks/use-realtime-stream'
import { useRealtimeRoom } from '@/hooks/use-realtime-room'
import { RealtimeCollaborationClient } from '@/lib/realtime'

// Mock WebSocket implementation for unit tests
class MockWebSocket {
  static instances: MockWebSocket[] = []
  url: string
  protocols?: string | string[]
  readyState: number = 0 // 0: CONNECTING, 1: OPEN, 2: CLOSING, 3: CLOSED
  onopen: ((ev: Event) => void) | null = null
  onclose: ((ev: CloseEvent) => void) | null = null
  onerror: ((ev: Event) => void) | null = null
  onmessage: ((ev: MessageEvent) => void) | null = null
  sentMessages: string[] = []

  constructor(url: string, protocols?: string | string[]) {
    this.url = url
    this.protocols = protocols
    MockWebSocket.instances.push(this)

    // Simulate async connection open
    setTimeout(() => {
      if (this.readyState === 0) {
        this.readyState = 1
        this.onopen?.(new Event('open'))
      }
    }, 10)
  }

  send(data: string) {
    this.sentMessages.push(data)
  }

  close(code: number = 1000, reason: string = '') {
    this.readyState = 3
    this.onclose?.({ code, reason } as CloseEvent)
  }

  // Test helpers to simulate server push
  simulateMessage(data: string | object) {
    const raw = typeof data === 'string' ? data : JSON.stringify(data)
    this.onmessage?.({ data: raw } as MessageEvent)
  }

  simulateError() {
    this.onerror?.(new Event('error'))
  }
}

describe('WebSocketClient', () => {
  let originalWebSocket: typeof WebSocket

  beforeEach(() => {
    MockWebSocket.instances = []
    originalWebSocket = globalThis.WebSocket
    const globalScope = globalThis as unknown as { WebSocket: typeof WebSocket }
    globalScope.WebSocket = MockWebSocket as unknown as typeof WebSocket
    vi.restoreAllMocks()
  })

  afterEach(() => {
    const globalScope = globalThis as unknown as { WebSocket: typeof WebSocket }
    globalScope.WebSocket = originalWebSocket
  })

  it('connects, tracks open state, and triggers onOpen', async () => {
    const onOpen = vi.fn()
    const client = createWebSocketClient({
      url: 'wss://live.example.com/feed',
      onOpen,
    })

    await client.connect()
    await waitFor(() => {
      expect(client.isConnected()).toBe(true)
    })

    expect(client.getStatus()).toBe('open')
    expect(onOpen).toHaveBeenCalledTimes(1)
    client.dispose()
  })

  it('parses JSON messages and dispatches typed event listeners', async () => {
    const client = createWebSocketClient({
      url: 'wss://live.example.com/events',
    })
    await client.connect()

    await waitFor(() => {
      expect(client.isConnected()).toBe(true)
    })

    const wsInstance = MockWebSocket.instances[0]
    const generalHandler = vi.fn()
    const typedHandler = vi.fn()

    client.onMessage(generalHandler)
    client.on('chat:message', typedHandler)

    wsInstance.simulateMessage({ type: 'chat:message', text: 'Hello pair programmer' })

    expect(generalHandler).toHaveBeenCalledTimes(1)
    expect(typedHandler).toHaveBeenCalledTimes(1)
    expect(typedHandler.mock.calls[0][0].data).toEqual({ type: 'chat:message', text: 'Hello pair programmer' })

    client.dispose()
  })

  it('queues messages when disconnected and flushes them upon open', async () => {
    const client = createWebSocketClient({
      url: 'wss://live.example.com/offline',
      queueOfflineMessages: true,
    })

    // Send while disconnected
    const queued1 = client.send({ id: 1, text: 'pending 1' })
    const queued2 = client.send({ id: 2, text: 'pending 2' })

    expect(queued1).toBe(true)
    expect(queued2).toBe(true)

    // Now connect
    await client.connect()
    await waitFor(() => {
      expect(client.isConnected()).toBe(true)
    })

    const wsInstance = MockWebSocket.instances[0]
    expect(wsInstance.sentMessages).toHaveLength(2)
    expect(JSON.parse(wsInstance.sentMessages[0])).toEqual({ id: 1, text: 'pending 1' })
    expect(JSON.parse(wsInstance.sentMessages[1])).toEqual({ id: 2, text: 'pending 2' })

    client.dispose()
  })

  it('does not auto-reconnect on terminal close codes (1008 policy violation)', async () => {
    const client = createWebSocketClient({
      url: 'wss://live.example.com/protected',
      reconnect: true,
      maxReconnectAttempts: 3,
    })

    await client.connect()
    await waitFor(() => {
      expect(client.isConnected()).toBe(true)
    })

    const wsInstance = MockWebSocket.instances[0]
    // Terminal unauthorized close
    wsInstance.close(1008, 'Unauthorized policy violation')

    expect(client.getStatus()).toBe('closed')
    // Wait briefly to confirm no new WebSocket instances were spawned
    await new Promise((res) => setTimeout(res, 50))
    expect(MockWebSocket.instances).toHaveLength(1)

    client.dispose()
  })

  it('sends heartbeat ping messages when enabled', async () => {
    const client = createWebSocketClient({
      url: 'wss://live.example.com/heartbeat',
      heartbeat: true,
      heartbeatIntervalMs: 20,
      heartbeatMessage: { type: 'ping' },
    })

    await client.connect()
    await waitFor(() => {
      expect(client.isConnected()).toBe(true)
    })

    const wsInstance = MockWebSocket.instances[0]
    await waitFor(() => {
      expect(wsInstance.sentMessages.length).toBeGreaterThanOrEqual(1)
    })
    expect(wsInstance.sentMessages[0]).toContain('"type":"ping"')

    client.dispose()
  })
})

describe('SSE Parser and Stream Consumer', () => {
  it('parses standard multiline SSE chunks with event, data, and id directives', () => {
    const rawChunk = `
event: update
id: evt_1
data: {"temperature": 22.4}

event: alert
data: Sensor threshold exceeded
data: Check cooling system
`
    const events = parseSSEChunk(rawChunk)
    expect(events).toHaveLength(2)
    expect(events[0]).toEqual({
      event: 'update',
      id: 'evt_1',
      data: '{"temperature": 22.4}',
      retry: undefined,
    })
    expect(events[1]).toEqual({
      event: 'alert',
      id: undefined,
      data: 'Sensor threshold exceeded\nCheck cooling system',
      retry: undefined,
    })
  })

  it('consumeSSE reads stream chunks and stops on [DONE]', async () => {
    const ssePayload = 'data: Hello\n\ndata: World\n\ndata: [DONE]\n\n'
    const encoder = new TextEncoder()

    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(ssePayload))
        controller.close()
      },
    })

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/event-stream' }),
      body: mockStream,
    })

    const chunks: string[] = []
    const onDone = vi.fn()

    await consumeSSE('https://api.example.com/ai/stream', {
      onChunk: (chunk) => chunks.push(chunk),
      onDone,
    })

    expect(chunks).toEqual(['Hello', 'World'])
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('consumeSSE attaches auth tokens and throws on HTTP errors', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      text: async () => 'Invalid stream token',
    })

    await expect(
      consumeSSE('https://api.example.com/stream', {
        authToken: 'token_xyz',
      })
    ).rejects.toThrow('SSE Connection failed')
  })
})

describe('useWebSocket React Hook', () => {
  let originalWebSocket: typeof WebSocket

  beforeEach(() => {
    MockWebSocket.instances = []
    originalWebSocket = globalThis.WebSocket
    const globalScope = globalThis as unknown as { WebSocket: typeof WebSocket }
    globalScope.WebSocket = MockWebSocket as unknown as typeof WebSocket
    vi.restoreAllMocks()
  })

  afterEach(() => {
    const globalScope = globalThis as unknown as { WebSocket: typeof WebSocket }
    globalScope.WebSocket = originalWebSocket
  })

  it('manages connection lifecycle and sends/receives messages', async () => {
    const { result } = renderHook(() =>
      useWebSocket('wss://live.example.com/hook-test')
    )

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true)
    })

    const wsInstance = MockWebSocket.instances[0]

    // Send message
    act(() => {
      const ok = result.current.send({ action: 'ping' })
      expect(ok).toBe(true)
    })
    expect(wsInstance.sentMessages[0]).toContain('"action":"ping"')

    // Receive message
    act(() => {
      wsInstance.simulateMessage({ type: 'pong', reply: true })
    })

    expect(result.current.lastMessage?.data).toEqual({ type: 'pong', reply: true })
  })

  it('cleans up and disposes socket when hook unmounts', async () => {
    const { result, unmount } = renderHook(() =>
      useWebSocket('wss://live.example.com/unmount-test')
    )

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true)
    })

    const wsInstance = MockWebSocket.instances[0]
    unmount()

    expect(wsInstance.readyState).toBe(3) // Closed
  })
})

describe('useRealtimeStream React Hook', () => {
  it('accumulates streamed text chunks and handles completion', async () => {
    const encoder = new TextEncoder()
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: First chunk \n\n'))
        controller.enqueue(encoder.encode('data: Second chunk\n\n'))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/event-stream' }),
      body: mockStream,
    })

    const { result } = renderHook(() =>
      useRealtimeStream('https://api.example.com/chat/stream')
    )

    await act(async () => {
      await result.current.start()
    })

    expect(result.current.text).toBe('First chunk Second chunk')
    expect(result.current.isStreaming).toBe(false)
  })

  it('aborts ongoing stream on reset or abort call', async () => {
    let controllerAborted = false
    const mockStream = new ReadableStream({
      start(controller) {
        // Keeps stream open
        setTimeout(() => {
          if (!controllerAborted) {
            controller.enqueue(new TextEncoder().encode('data: test\n\n'))
          }
        }, 50)
      },
      cancel() {
        controllerAborted = true
      },
    })

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/event-stream' }),
      body: mockStream,
    })

    const { result } = renderHook(() =>
      useRealtimeStream('https://api.example.com/chat/stream')
    )

    await act(async () => {
      void result.current.start()
    })

    act(() => {
      result.current.abort()
    })

    expect(result.current.isStreaming).toBe(false)
  })
})

describe('useRealtimeRoom Hook', () => {
  it('subscribes to room state, presence, and leaves room on unmount', async () => {
    const client = new RealtimeCollaborationClient()
    const joinSpy = vi.spyOn(client, 'joinRoom')
    const leaveSpy = vi.spyOn(client, 'leaveRoom')

    const { result, unmount } = renderHook(() =>
      useRealtimeRoom({
        roomId: 'room_collab_1',
        client,
        initialPresence: { role: 'editor' },
      })
    )

    expect(joinSpy).toHaveBeenCalledWith('room_collab_1', { role: 'editor' })
    expect(result.current.myPresence).toEqual({ role: 'editor' })

    // Simulate incoming room_joined state sync
    act(() => {
      client.receiveMessage({
        type: 'room_joined',
        payload: {
          roomId: 'room_collab_1',
          sequence: 1,
          state: { docName: 'Proposal.pdf' },
          stateVersions: { docName: 1 },
          presence: {
            peer_1: {
              clientId: 'peer_1',
              joinedAt: 1000,
              updatedAt: 1000,
              data: { role: 'viewer' },
            },
          },
        },
      })
    })

    expect(result.current.state).toEqual({ docName: 'Proposal.pdf' })
    expect(result.current.presence['peer_1']).toBeDefined()

    // Test updating own presence
    const presenceSpy = vi.spyOn(client, 'updatePresence')
    act(() => {
      result.current.updatePresence({ role: 'reviewer' })
    })
    expect(presenceSpy).toHaveBeenCalledWith('room_collab_1', { role: 'reviewer' })
    expect(result.current.myPresence).toEqual({ role: 'reviewer' })

    // Unmount hook -> should leave room cleanly
    unmount()
    expect(leaveSpy).toHaveBeenCalledWith('room_collab_1')
  })
})

