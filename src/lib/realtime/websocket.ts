/**
 * Reusable WebSocket Client
 * 
 * Capabilities:
 * - Connection lifecycle management (connecting, open, closing, closed)
 * - Exponential backoff with jitter on reconnect
 * - Detection of permanent terminal closures (401/403/1008 policy rejection)
 * - Offline message queuing with bounded buffer
 * - Heartbeat / ping-pong keepalive with dead socket detection
 * - Typed event listeners and JSON message serialization
 * - Safe SSR / Node compatibility
 * - Clean disposal and event listener unbinding
 */

export type WebSocketStatus = 'connecting' | 'open' | 'closing' | 'closed'

export interface WebSocketMessage<T = unknown> {
  type?: string
  data: T
  raw: string | ArrayBuffer | Blob
  timestamp: number
}

export type MessageHandler<T = unknown> = (message: WebSocketMessage<T>) => void

export interface WebSocketClientOptions {
  url: string | (() => string | Promise<string>)
  protocols?: string | string[]
  autoConnect?: boolean
  reconnect?: boolean
  maxReconnectAttempts?: number
  reconnectIntervalMs?: number
  maxReconnectIntervalMs?: number
  heartbeat?: boolean
  heartbeatIntervalMs?: number
  heartbeatTimeoutMs?: number
  heartbeatMessage?: string | Record<string, unknown>
  queueOfflineMessages?: boolean
  maxQueueSize?: number
  onOpen?: (event: Event) => void
  onClose?: (event: CloseEvent) => void
  onError?: (event: Event) => void
  onMessage?: (message: WebSocketMessage) => void
  onStatusChange?: (status: WebSocketStatus) => void
}

/** Terminal close codes that should not trigger automatic reconnect loops */
const TERMINAL_CLOSE_CODES = new Set([
  1008, // Policy Violation
  4001, // Custom: Unauthorized
  4401, // Custom: Unauthorized
  4003, // Custom: Forbidden
  4403, // Custom: Forbidden
])

export class WebSocketClient {
  private ws: WebSocket | null = null
  private status: WebSocketStatus = 'closed'
  private reconnectAttempts = 0
  private reconnectTimer: NodeJS.Timeout | null = null
  private heartbeatIntervalTimer: NodeJS.Timeout | null = null
  private heartbeatTimeoutTimer: NodeJS.Timeout | null = null
  private offlineQueue: Array<string | ArrayBuffer | Blob> = []
  private isDisposed = false

  private messageHandlers = new Set<MessageHandler>()
  private typedHandlers = new Map<string, Set<MessageHandler<unknown>>>()
  private statusListeners = new Set<(status: WebSocketStatus) => void>()

  private options: Required<
    Omit<
      WebSocketClientOptions,
      'protocols' | 'onOpen' | 'onClose' | 'onError' | 'onMessage' | 'onStatusChange'
    >
  > & {
    protocols?: string | string[]
    onOpen?: (event: Event) => void
    onClose?: (event: CloseEvent) => void
    onError?: (event: Event) => void
    onMessage?: (message: WebSocketMessage) => void
    onStatusChange?: (status: WebSocketStatus) => void
  }

  constructor(options: WebSocketClientOptions) {
    this.options = {
      protocols: options.protocols,
      autoConnect: options.autoConnect ?? false,
      reconnect: options.reconnect ?? true,
      maxReconnectAttempts: options.maxReconnectAttempts ?? 5,
      reconnectIntervalMs: options.reconnectIntervalMs ?? 1000,
      maxReconnectIntervalMs: options.maxReconnectIntervalMs ?? 15000,
      heartbeat: options.heartbeat ?? false,
      heartbeatIntervalMs: options.heartbeatIntervalMs ?? 30000,
      heartbeatTimeoutMs: options.heartbeatTimeoutMs ?? 5000,
      heartbeatMessage: options.heartbeatMessage ?? JSON.stringify({ type: 'ping' }),
      queueOfflineMessages: options.queueOfflineMessages ?? true,
      maxQueueSize: options.maxQueueSize ?? 50,
      url: options.url,
      onOpen: options.onOpen,
      onClose: options.onClose,
      onError: options.onError,
      onMessage: options.onMessage,
      onStatusChange: options.onStatusChange,
    }

    if (this.options.autoConnect) {
      void this.connect()
    }
  }

  public getStatus(): WebSocketStatus {
    return this.status
  }

  public isConnected(): boolean {
    return this.status === 'open'
  }

  public async connect(): Promise<void> {
    if (this.isDisposed) return
    if (this.status === 'open' || this.status === 'connecting') return

    // Guard against SSR environments without native WebSocket
    const WSImpl =
      typeof WebSocket !== 'undefined'
        ? WebSocket
        : (globalThis as unknown as { WebSocket?: typeof WebSocket }).WebSocket
    if (!WSImpl) {
      this.setStatus('closed')
      return
    }

    this.setStatus('connecting')

    try {
      const resolvedUrl = typeof this.options.url === 'function' ? await this.options.url() : this.options.url

      this.ws = this.options.protocols ? new WSImpl(resolvedUrl, this.options.protocols) : new WSImpl(resolvedUrl)

      this.setupSocketListeners()
    } catch {
      this.setStatus('closed')
      this.handleReconnect()
    }
  }

  public disconnect(code: number = 1000, reason: string = 'Normal Closure'): void {
    this.clearTimers()
    if (this.ws) {
      this.setStatus('closing')
      try {
        this.ws.close(code, reason)
      } catch {
        // ignore close error
      }
      this.ws = null
    }
    this.setStatus('closed')
  }

  public dispose(): void {
    this.isDisposed = true
    this.disconnect()
    this.offlineQueue = []
    this.messageHandlers.clear()
    this.typedHandlers.clear()
    this.statusListeners.clear()
  }

  public send(data: unknown): boolean {
    if (this.isDisposed) return false

    const serialized: string | ArrayBuffer | Blob =
      typeof data === 'string' || data instanceof ArrayBuffer || (typeof Blob !== 'undefined' && data instanceof Blob)
        ? (data as string | ArrayBuffer | Blob)
        : JSON.stringify(data)

    if (this.status === 'open' && this.ws) {
      try {
        this.ws.send(serialized)
        return true
      } catch {
        return false
      }
    }

    if (this.options.queueOfflineMessages) {
      if (this.offlineQueue.length >= this.options.maxQueueSize) {
        this.offlineQueue.shift() // Drop oldest message
      }
      this.offlineQueue.push(serialized)
      return true
    }

    return false
  }

  public onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler)
    return () => this.messageHandlers.delete(handler)
  }

  public onStatusChange(handler: (status: WebSocketStatus) => void): () => void {
    this.statusListeners.add(handler)
    return () => this.statusListeners.delete(handler)
  }

  public on<T = unknown>(type: string, handler: MessageHandler<T>): () => void {
    if (!this.typedHandlers.has(type)) {
      this.typedHandlers.set(type, new Set())
    }
    const set = this.typedHandlers.get(type)!
    const rawHandler = handler as MessageHandler<unknown>
    set.add(rawHandler)

    return () => {
      set.delete(rawHandler)
      if (set.size === 0) {
        this.typedHandlers.delete(type)
      }
    }
  }

  private setStatus(newStatus: WebSocketStatus): void {
    if (this.status !== newStatus) {
      this.status = newStatus
      this.options.onStatusChange?.(newStatus)
      for (const listener of this.statusListeners) {
        listener(newStatus)
      }
    }
  }

  private setupSocketListeners(): void {
    if (!this.ws) return

    this.ws.onopen = (event: Event) => {
      this.setStatus('open')
      this.reconnectAttempts = 0
      this.options.onOpen?.(event)
      this.flushOfflineQueue()
      this.startHeartbeat()
    }

    this.ws.onclose = (event: CloseEvent) => {
      this.stopHeartbeat()
      this.setStatus('closed')
      this.options.onClose?.(event)
      this.ws = null

      if (!this.isDisposed && this.options.reconnect) {
        // Do not auto-reconnect if closure was terminal authorization/policy failure
        if (!TERMINAL_CLOSE_CODES.has(event.code)) {
          this.handleReconnect()
        }
      }
    }

    this.ws.onerror = (event: Event) => {
      this.options.onError?.(event)
    }

    this.ws.onmessage = (event: MessageEvent) => {
      this.resetHeartbeatTimeout()
      this.parseAndDispatchMessage(event.data)
    }
  }

  private parseAndDispatchMessage(rawData: string | ArrayBuffer | Blob): void {
    let parsed: unknown = rawData
    let eventType: string | undefined = undefined

    if (typeof rawData === 'string') {
      try {
        const json = JSON.parse(rawData)
        parsed = json
        if (json && typeof json === 'object' && 'type' in json && typeof json.type === 'string') {
          eventType = json.type
        }
      } catch {
        parsed = rawData
      }
    }

    const message: WebSocketMessage = {
      type: eventType,
      data: parsed,
      raw: rawData,
      timestamp: Date.now(),
    }

    this.options.onMessage?.(message)

    for (const handler of this.messageHandlers) {
      try {
        handler(message)
      } catch {
        // ignore subscriber errors
      }
    }

    if (eventType && this.typedHandlers.has(eventType)) {
      const handlers = this.typedHandlers.get(eventType)!
      for (const handler of handlers) {
        try {
          handler(message)
        } catch {
          // ignore subscriber errors
        }
      }
    }
  }

  private handleReconnect(): void {
    if (this.isDisposed || !this.options.reconnect) return
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      return
    }

    this.reconnectAttempts++
    // Exponential backoff with jitter
    const backoff = Math.min(
      this.options.maxReconnectIntervalMs,
      this.options.reconnectIntervalMs * Math.pow(1.5, this.reconnectAttempts - 1)
    )
    const jitter = backoff * (0.8 + Math.random() * 0.4)

    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = setTimeout(() => {
      void this.connect()
    }, jitter)
  }

  private flushOfflineQueue(): void {
    if (this.offlineQueue.length === 0 || !this.ws) return

    while (this.offlineQueue.length > 0) {
      const msg = this.offlineQueue.shift()
      if (msg) {
        try {
          this.ws.send(msg)
        } catch {
          break
        }
      }
    }
  }

  private startHeartbeat(): void {
    if (!this.options.heartbeat) return
    this.stopHeartbeat()

    this.heartbeatIntervalTimer = setInterval(() => {
      if (this.status === 'open' && this.ws) {
        const msg =
          typeof this.options.heartbeatMessage === 'object'
            ? JSON.stringify(this.options.heartbeatMessage)
            : this.options.heartbeatMessage
        try {
          this.ws.send(msg)
          // Start timeout waiting for message reply
          this.heartbeatTimeoutTimer = setTimeout(() => {
            // Socket considered dead, disconnect to trigger reconnect
            if (this.ws) {
              try {
                this.ws.close(4000, 'Heartbeat timeout')
              } catch {
                // ignore
              }
            }
          }, this.options.heartbeatTimeoutMs)
        } catch {
          // send failed
        }
      }
    }, this.options.heartbeatIntervalMs)
  }

  private resetHeartbeatTimeout(): void {
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer)
      this.heartbeatTimeoutTimer = null
    }
  }

  private stopHeartbeat(): void {
    if (this.heartbeatIntervalTimer) {
      clearInterval(this.heartbeatIntervalTimer)
      this.heartbeatIntervalTimer = null
    }
    this.resetHeartbeatTimeout()
  }

  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.stopHeartbeat()
  }
}

export function createWebSocketClient(options: WebSocketClientOptions): WebSocketClient {
  return new WebSocketClient(options)
}
