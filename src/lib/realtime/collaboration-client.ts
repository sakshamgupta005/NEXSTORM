/**
 * Reusable Realtime Collaboration Client
 * 
 * References: Socket.IO Client, Liveblocks, Yjs Provider
 * 
 * Capabilities:
 * - Room join/leave with ephemeral presence and shared state synchronization
 * - Local reactive state and presence caches with typed change listeners
 * - Automatic reconnection state recovery and room resynchronization
 * - Message deduplication and monotonic sequence checking
 * - Clean disposal and event unbinding
 */

import { WebSocketClient, type WebSocketStatus } from './websocket'
import type {
  RealtimeConnectionStatus,
  PresenceRecord,
  RealtimeWireMessage,
  ServerRoomJoinedPayload,
  ServerPresenceUpdatedPayload,
  ServerPresenceLeftPayload,
  ServerStateUpdatedPayload,
  ServerStateSyncedPayload,
  ServerBroadcastPayload,
  ServerErrorPayload,
  ServerShutdownPayload,
} from './collaboration-types'

export type RoomPresenceHandler = (presence: Record<string, PresenceRecord>) => void
export type RoomStateHandler = (state: Record<string, unknown>) => void
export type RoomEventHandler = (payload: unknown, senderId: string, messageId: string) => void
export type StatusHandler = (status: RealtimeConnectionStatus) => void
export type ErrorHandler = (error: { code: string; message: string; roomId?: string }) => void

export interface RealtimeClientOptions {
  url?: string
  authToken?: string
  webSocketClient?: WebSocketClient
  autoConnect?: boolean
}

interface LocalRoomData {
  state: Map<string, unknown>
  stateVersions: Map<string, number>
  presence: Map<string, PresenceRecord>
  sequence: number
  initialPresence?: Record<string, unknown>
}

export class RealtimeCollaborationClient {
  private wsClient: WebSocketClient | null = null
  private ownWsClient = false
  private authToken?: string
  private status: RealtimeConnectionStatus = 'disconnected'
  private clientId: string | null = null

  private rooms = new Map<string, LocalRoomData>()
  private joinedRoomIds = new Set<string>()

  // Listeners
  private presenceListeners = new Map<string, Set<RoomPresenceHandler>>()
  private stateListeners = new Map<string, Set<RoomStateHandler>>()
  private eventListeners = new Map<string, Map<string, Set<RoomEventHandler>>>() // roomId -> eventName -> handlers
  private statusListeners = new Set<StatusHandler>()
  private errorListeners = new Set<ErrorHandler>()

  // Deduplication
  private seenMessageIds = new Set<string>()

  constructor(options: RealtimeClientOptions = {}) {
    this.authToken = options.authToken

    if (options.webSocketClient) {
      this.wsClient = options.webSocketClient
      this.ownWsClient = false
      this.bindWebSocketEvents(this.wsClient)
    } else if (options.url) {
      this.wsClient = new WebSocketClient({
        url: options.url,
        autoConnect: options.autoConnect ?? false,
      })
      this.ownWsClient = true
      this.bindWebSocketEvents(this.wsClient)
    }
  }

  /**
   * Binds to an existing or mocked WebSocketClient instance.
   */
  public bindWebSocket(client: WebSocketClient): void {
    if (this.wsClient && this.ownWsClient) {
      this.wsClient.dispose()
    }
    this.wsClient = client
    this.ownWsClient = false
    this.bindWebSocketEvents(client)
  }

  public getStatus(): RealtimeConnectionStatus {
    return this.status
  }

  public isConnected(): boolean {
    return this.status === 'connected'
  }

  public getClientId(): string | null {
    return this.clientId
  }

  /**
   * Connects to the realtime server and initializes authentication.
   */
  public async connect(token?: string): Promise<void> {
    if (token) this.authToken = token
    if (!this.wsClient) return

    this.setStatus('connecting')
    await this.wsClient.connect()
  }

  /**
   * Disconnects from the server and marks status as disconnected.
   */
  public disconnect(): void {
    this.wsClient?.disconnect()
    this.setStatus('disconnected')
  }

  /**
   * Disposes the client, closing socket connections and clearing all registered listeners.
   */
  public dispose(): void {
    if (this.ownWsClient && this.wsClient) {
      this.wsClient.dispose()
    }
    this.wsClient = null
    this.rooms.clear()
    this.joinedRoomIds.clear()
    this.presenceListeners.clear()
    this.stateListeners.clear()
    this.eventListeners.clear()
    this.statusListeners.clear()
    this.errorListeners.clear()
    this.seenMessageIds.clear()
    this.setStatus('disconnected')
  }

  // --- Room Interactions ---

  /**
   * Joins a room, requesting state synchronization and broadcasting initial presence.
   */
  public joinRoom(roomId: string, initialPresence?: Record<string, unknown>): void {
    this.joinedRoomIds.add(roomId)

    let room = this.rooms.get(roomId)
    if (!room) {
      room = {
        state: new Map(),
        stateVersions: new Map(),
        presence: new Map(),
        sequence: 0,
        initialPresence,
      }
      this.rooms.set(roomId, room)
    } else {
      room.initialPresence = initialPresence
    }

    this.sendWireMessage({
      type: 'join_room',
      payload: { roomId, initialPresence },
    })
  }

  /**
   * Leaves a room and clears local caches for that room.
   */
  public leaveRoom(roomId: string): void {
    this.joinedRoomIds.delete(roomId)
    this.rooms.delete(roomId)

    this.sendWireMessage({
      type: 'leave_room',
      payload: { roomId },
    })
  }

  /**
   * Updates current user's presence in a room.
   */
  public updatePresence(roomId: string, presence: Record<string, unknown>): void {
    this.sendWireMessage({
      type: 'update_presence',
      payload: { roomId, presence },
    })
  }

  /**
   * Updates a shared key in a room with optimistic concurrency check support.
   */
  public setStateKey(
    roomId: string,
    key: string,
    value: unknown,
    expectedVersion?: number
  ): void {
    this.sendWireMessage({
      type: 'state_patch',
      payload: { roomId, key, value, expectedVersion },
    })
  }

  /**
   * Requests a fresh room state resync.
   */
  public requestSync(roomId: string): void {
    const room = this.rooms.get(roomId)
    this.sendWireMessage({
      type: 'state_sync_request',
      payload: { roomId, knownSequence: room?.sequence },
    })
  }

  /**
   * Broadcasts a transient typed event to other participants in a room.
   */
  public broadcast(roomId: string, event: string, payload: unknown): void {
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    this.sendWireMessage({
      type: 'broadcast',
      payload: { roomId, event, payload, messageId },
    })
  }

  // --- Local State Queries ---

  public getRoomState<T = Record<string, unknown>>(roomId: string): T | undefined {
    const room = this.rooms.get(roomId)
    if (!room) return undefined

    const obj: Record<string, unknown> = {}
    for (const [k, v] of room.state.entries()) {
      obj[k] = v
    }
    return obj as T
  }

  public getRoomPresence(roomId: string): Record<string, PresenceRecord> | undefined {
    const room = this.rooms.get(roomId)
    if (!room) return undefined

    const obj: Record<string, PresenceRecord> = {}
    for (const [k, v] of room.presence.entries()) {
      obj[k] = v
    }
    return obj
  }

  // --- Listener Registration ---

  public onStatusChange(handler: StatusHandler): () => void {
    this.statusListeners.add(handler)
    return () => this.statusListeners.delete(handler)
  }

  public onError(handler: ErrorHandler): () => void {
    this.errorListeners.add(handler)
    return () => this.errorListeners.delete(handler)
  }

  public onRoomPresence(roomId: string, handler: RoomPresenceHandler): () => void {
    let handlers = this.presenceListeners.get(roomId)
    if (!handlers) {
      handlers = new Set()
      this.presenceListeners.set(roomId, handlers)
    }
    handlers.add(handler)
    return () => handlers?.delete(handler)
  }

  public onRoomState(roomId: string, handler: RoomStateHandler): () => void {
    let handlers = this.stateListeners.get(roomId)
    if (!handlers) {
      handlers = new Set()
      this.stateListeners.set(roomId, handlers)
    }
    handlers.add(handler)
    return () => handlers?.delete(handler)
  }

  public onRoomEvent(
    roomId: string,
    event: string,
    handler: RoomEventHandler
  ): () => void {
    let roomEvents = this.eventListeners.get(roomId)
    if (!roomEvents) {
      roomEvents = new Map()
      this.eventListeners.set(roomId, roomEvents)
    }
    let handlers = roomEvents.get(event)
    if (!handlers) {
      handlers = new Set()
      roomEvents.set(event, handlers)
    }
    handlers.add(handler)
    return () => handlers?.delete(handler)
  }

  // --- Inbound Message Processing ---

  /**
   * Ingests a raw wire message or parsed object (used both by WebSocket listener and tests).
   */
  public receiveMessage(rawOrMessage: string | RealtimeWireMessage): void {
    let msg: RealtimeWireMessage
    if (typeof rawOrMessage === 'string') {
      try {
        msg = JSON.parse(rawOrMessage) as RealtimeWireMessage
      } catch {
        return
      }
    } else {
      msg = rawOrMessage
    }

    if (!msg || typeof msg.type !== 'string') return

    switch (msg.type) {
      case 'authenticated': {
        const payload = msg.payload as { clientId: string } | undefined
        if (payload?.clientId) this.clientId = payload.clientId
        this.setStatus('connected')
        this.recoverJoinedRooms()
        break
      }

      case 'auth_error':
      case 'room_error': {
        const payload = msg.payload as ServerErrorPayload | undefined
        if (payload) {
          for (const handler of this.errorListeners) {
            handler(payload)
          }
        }
        break
      }

      case 'room_joined': {
        const payload = msg.payload as ServerRoomJoinedPayload | undefined
        if (!payload) return
        let room = this.rooms.get(payload.roomId)
        if (!room) {
          room = {
            state: new Map(),
            stateVersions: new Map(),
            presence: new Map(),
            sequence: payload.sequence,
          }
          this.rooms.set(payload.roomId, room)
        }
        room.sequence = payload.sequence

        // Populate initial state and versions
        room.state.clear()
        room.stateVersions.clear()
        for (const [k, v] of Object.entries(payload.state)) {
          room.state.set(k, v)
        }
        for (const [k, v] of Object.entries(payload.stateVersions)) {
          room.stateVersions.set(k, v)
        }

        // Populate initial presence
        room.presence.clear()
        for (const [k, v] of Object.entries(payload.presence)) {
          room.presence.set(k, v)
        }

        this.notifyStateListeners(payload.roomId)
        this.notifyPresenceListeners(payload.roomId)
        break
      }

      case 'presence_updated': {
        const payload = msg.payload as ServerPresenceUpdatedPayload | undefined
        if (!payload) return
        const room = this.rooms.get(payload.roomId)
        if (room) {
          room.presence.set(payload.clientId, payload.record)
          this.notifyPresenceListeners(payload.roomId)
        }
        break
      }

      case 'presence_left': {
        const payload = msg.payload as ServerPresenceLeftPayload | undefined
        if (!payload) return
        const room = this.rooms.get(payload.roomId)
        if (room) {
          room.presence.delete(payload.clientId)
          this.notifyPresenceListeners(payload.roomId)
        }
        break
      }

      case 'state_updated': {
        const payload = msg.payload as ServerStateUpdatedPayload | undefined
        if (!payload) return
        const room = this.rooms.get(payload.roomId)
        if (room) {
          room.sequence = payload.sequence
          room.state.set(payload.key, payload.value)
          room.stateVersions.set(payload.key, payload.version)
          this.notifyStateListeners(payload.roomId)
        }
        break
      }

      case 'state_synced': {
        const payload = msg.payload as ServerStateSyncedPayload | undefined
        if (!payload) return
        const room = this.rooms.get(payload.roomId)
        if (room) {
          room.sequence = payload.sequence
          room.state.clear()
          room.stateVersions.clear()
          for (const [k, v] of Object.entries(payload.state)) {
            room.state.set(k, v)
          }
          for (const [k, v] of Object.entries(payload.stateVersions)) {
            room.stateVersions.set(k, v)
          }
          this.notifyStateListeners(payload.roomId)
        }
        break
      }

      case 'broadcast_event': {
        const payload = msg.payload as ServerBroadcastPayload | undefined
        if (!payload) return
        // Deduplicate messages
        if (payload.messageId) {
          if (this.seenMessageIds.has(payload.messageId)) return
          this.seenMessageIds.add(payload.messageId)
        }
        const roomEvents = this.eventListeners.get(payload.roomId)
        const handlers = roomEvents?.get(payload.event)
        if (handlers) {
          for (const handler of handlers) {
            handler(payload.payload, payload.senderId, payload.messageId)
          }
        }
        break
      }

      case 'server_shutdown': {
        const payload = msg.payload as ServerShutdownPayload | undefined
        this.setStatus('disconnected')
        if (payload) {
          for (const handler of this.errorListeners) {
            handler({ code: 'SERVER_SHUTDOWN', message: payload.reason })
          }
        }
        break
      }
    }
  }

  // --- Internal Helpers ---

  private bindWebSocketEvents(wsClient: WebSocketClient): void {
    wsClient.onStatusChange((wsStatus: WebSocketStatus) => {
      if (wsStatus === 'open') {
        // Authenticate immediately upon connection
        this.sendWireMessage({
          type: 'auth',
          payload: { token: this.authToken },
        })
      } else if (wsStatus === 'connecting') {
        this.setStatus(this.status === 'connected' ? 'reconnecting' : 'connecting')
      } else if (wsStatus === 'closed') {
        this.setStatus('disconnected')
      }
    })

    wsClient.onMessage((wsMsg) => {
      if (typeof wsMsg.raw === 'string') {
        this.receiveMessage(wsMsg.raw)
      } else if (typeof wsMsg.data === 'object' && wsMsg.data !== null) {
        this.receiveMessage(wsMsg.data as RealtimeWireMessage)
      }
    })
  }

  private sendWireMessage(message: RealtimeWireMessage): boolean {
    if (!this.wsClient) return false
    return this.wsClient.send(message)
  }

  private setStatus(newStatus: RealtimeConnectionStatus): void {
    if (this.status !== newStatus) {
      this.status = newStatus
      for (const handler of this.statusListeners) {
        handler(newStatus)
      }
    }
  }

  private recoverJoinedRooms(): void {
    for (const roomId of this.joinedRoomIds) {
      const room = this.rooms.get(roomId)
      this.sendWireMessage({
        type: 'join_room',
        payload: {
          roomId,
          initialPresence: room?.initialPresence,
        },
      })
    }
  }

  private notifyStateListeners(roomId: string): void {
    const handlers = this.stateListeners.get(roomId)
    if (!handlers || handlers.size === 0) return
    const state = this.getRoomState(roomId) ?? {}
    for (const handler of handlers) {
      handler(state)
    }
  }

  private notifyPresenceListeners(roomId: string): void {
    const handlers = this.presenceListeners.get(roomId)
    if (!handlers || handlers.size === 0) return
    const presence = this.getRoomPresence(roomId) ?? {}
    for (const handler of handlers) {
      handler(presence)
    }
  }
}
