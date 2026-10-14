/**
 * Reusable Realtime Collaboration Server & Room Manager
 * 
 * References: Socket.IO, Liveblocks, PartyKit
 * 
 * Capabilities:
 * - Room lifecycle, presence tracking, and membership control
 * - Deterministic Last-Write-Wins (LWW) versioned shared state sync
 * - Low-overhead message deduplication and monotonic sequence ordering
 * - Transport-agnostic socket abstraction (Node, Next.js, Mock)
 * - Rate limiting, payload size constraints, and auth guards
 * - Graceful shutdown and clean connection draining
 */

import type {
  ISocketConnection,
  RealtimeWireMessage,
  RealtimeUser,
  PresenceRecord,
  RoomStateEntry,
  RoomSnapshot,
  RealtimeServerOptions,
  ClientAuthPayload,
  ClientJoinRoomPayload,
  ClientLeaveRoomPayload,
  ClientUpdatePresencePayload,
  ClientStatePatchPayload,
  ClientSyncRequestPayload,
  ClientBroadcastPayload,
  ServerRoomJoinedPayload,
  ServerStateUpdatedPayload,
  ServerBroadcastPayload,
} from './collaboration-types'
import { sharedMetrics } from '../observability/metrics'
import { logger } from '../logging/logger'

interface RoomData {
  id: string
  members: Set<string>
  state: Map<string, RoomStateEntry<unknown>>
  presence: Map<string, PresenceRecord>
  sequence: number
}

interface ClientRateLimitState {
  count: number
  windowStart: number
}

export class RealtimeServer {
  private sockets = new Map<string, ISocketConnection>()
  private clientUsers = new Map<string, RealtimeUser | null>()
  private clientRooms = new Map<string, Set<string>>()
  private rooms = new Map<string, RoomData>()
  private rateLimits = new Map<string, ClientRateLimitState>()
  private seenMessageIds = new Map<string, number>()
  private options: Required<RealtimeServerOptions>
  private isShuttingDown = false

  constructor(options: RealtimeServerOptions = {}) {
    this.options = {
      maxMessageSizeBytes: options.maxMessageSizeBytes ?? 64 * 1024, // 64KB
      rateLimitPerSecond: options.rateLimitPerSecond ?? 50,
      maxRoomsPerClient: options.maxRoomsPerClient ?? 50,
      dedupCacheTtlMs: options.dedupCacheTtlMs ?? 60_000,
      authenticate: options.authenticate ?? (() => null),
      canJoinRoom: options.canJoinRoom ?? ((_u, roomId) => !roomId.startsWith('private:')),
      canPublish: options.canPublish ?? (() => true),
    }
  }

  /**
   * Registers a newly connected socket and authenticates if credentials are provided.
   */
  public async registerConnection(
    socket: ISocketConnection,
    authPayload?: ClientAuthPayload
  ): Promise<void> {
    if (this.isShuttingDown) {
      socket.close(1001, 'Server shutting down')
      return
    }

    this.sockets.set(socket.id, socket)
    this.clientRooms.set(socket.id, new Set())

    try {
      const user = authPayload?.token ? await this.options.authenticate(authPayload.token) : null
      this.clientUsers.set(socket.id, user)

      this.sendToSocket(socket.id, {
        type: 'authenticated',
        payload: {
          clientId: socket.id,
          user: user ?? undefined,
        },
      })
    } catch {
      this.clientUsers.set(socket.id, null)
      this.sendToSocket(socket.id, {
        type: 'auth_error',
        payload: {
          code: 'AUTH_FAILED',
          message: 'Authentication rejected by server hook',
        },
      })
    }

    try {
      sharedMetrics.gauge('realtime_connections_active').set({}, this.sockets.size)
    } catch {
      // Metric recording errors must not crash server operations
    }
  }

  /**
   * Unregisters a disconnected socket, cleanly vacating all rooms and broadcasting presence departures.
   */
  public unregisterConnection(socketId: string): void {
    const joinedRooms = this.clientRooms.get(socketId)

    if (joinedRooms) {
      for (const roomId of joinedRooms) {
        this.leaveRoomInternal(socketId, roomId)
      }
    }

    this.sockets.delete(socketId)
    this.clientUsers.delete(socketId)
    this.clientRooms.delete(socketId)
    this.rateLimits.delete(socketId)

    try {
      sharedMetrics.gauge('realtime_connections_active').set({}, this.sockets.size)
    } catch {
      // Metric recording errors must not crash server operations
    }
  }

  /**
   * Processes an incoming raw string message from a connected client.
   */
  public async handleMessage(socketId: string, rawMessage: string): Promise<void> {
    const socket = this.sockets.get(socketId)
    if (!socket) return

    // 1. Message size check
    if (rawMessage.length > this.options.maxMessageSizeBytes) {
      this.sendError(socketId, 'PAYLOAD_TOO_LARGE', 'Message exceeds maximum allowable size')
      return
    }

    // 2. Client rate-limit check (sliding 1-second window)
    const now = Date.now()
    const rateState = this.rateLimits.get(socketId) ?? { count: 0, windowStart: now }
    if (now - rateState.windowStart > 1000) {
      rateState.count = 1
      rateState.windowStart = now
    } else {
      rateState.count++
    }
    this.rateLimits.set(socketId, rateState)

    if (rateState.count > this.options.rateLimitPerSecond) {
      this.sendError(socketId, 'RATE_LIMIT_EXCEEDED', 'Message rate limit exceeded. Slow down.')
      return
    }

    // 3. JSON parse check
    let parsed: RealtimeWireMessage
    try {
      parsed = JSON.parse(rawMessage) as RealtimeWireMessage
    } catch {
      this.sendError(socketId, 'INVALID_JSON', 'Malformed JSON payload')
      return
    }

    if (!parsed || typeof parsed.type !== 'string') {
      this.sendError(socketId, 'INVALID_MESSAGE', 'Message must contain a valid string type')
      return
    }

    // 4. Message deduplication check
    if (parsed.id) {
      const prevSeen = this.seenMessageIds.get(parsed.id)
      if (prevSeen && now - prevSeen < this.options.dedupCacheTtlMs) {
        // Idempotent duplicate: acknowledge/skip without re-executing
        return
      }
      this.seenMessageIds.set(parsed.id, now)
      this.cleanupOldDedupKeys(now)
    }

    try {
      sharedMetrics.counter('realtime_messages_total').inc({
        direction: 'in',
        type: parsed.type,
      })
    } catch {
      // Observability failures must not block message dispatch
    }

    // 5. Dispatch by message type
    switch (parsed.type) {
      case 'ping': {
        this.sendToSocket(socketId, { type: 'pong', payload: { timestamp: now } })
        break
      }

      case 'auth': {
        const payload = parsed.payload as ClientAuthPayload | undefined
        await this.handleAuthMessage(socketId, payload)
        break
      }

      case 'join_room': {
        const payload = parsed.payload as ClientJoinRoomPayload | undefined
        await this.handleJoinRoom(socketId, payload)
        break
      }

      case 'leave_room': {
        const payload = parsed.payload as ClientLeaveRoomPayload | undefined
        this.handleLeaveRoom(socketId, payload)
        break
      }

      case 'update_presence': {
        const payload = parsed.payload as ClientUpdatePresencePayload | undefined
        this.handleUpdatePresence(socketId, payload)
        break
      }

      case 'state_patch': {
        const payload = parsed.payload as ClientStatePatchPayload | undefined
        this.handleStatePatch(socketId, payload)
        break
      }

      case 'state_sync_request': {
        const payload = parsed.payload as ClientSyncRequestPayload | undefined
        this.handleSyncRequest(socketId, payload)
        break
      }

      case 'broadcast': {
        const payload = parsed.payload as ClientBroadcastPayload | undefined
        await this.handleBroadcast(socketId, payload)
        break
      }

      default: {
        this.sendError(socketId, 'UNKNOWN_TYPE', `Unrecognized message type: ${parsed.type}`)
      }
    }
  }

  // --- Handlers for specific message types ---

  private async handleAuthMessage(
    socketId: string,
    payload?: ClientAuthPayload
  ): Promise<void> {
    try {
      const user = payload?.token ? await this.options.authenticate(payload.token) : null
      this.clientUsers.set(socketId, user)

      this.sendToSocket(socketId, {
        type: 'authenticated',
        payload: { clientId: socketId, user: user ?? undefined },
      })
    } catch {
      this.sendError(socketId, 'AUTH_FAILED', 'Authentication verification failed')
    }
  }

  private async handleJoinRoom(
    socketId: string,
    payload?: ClientJoinRoomPayload
  ): Promise<void> {
    if (!payload?.roomId || typeof payload.roomId !== 'string') {
      this.sendError(socketId, 'INVALID_ROOM', 'A valid roomId is required')
      return
    }

    const { roomId, initialPresence } = payload
    const user = this.clientUsers.get(socketId) ?? null

    // Room limit check
    const clientRooms = this.clientRooms.get(socketId)
    if (clientRooms && clientRooms.size >= this.options.maxRoomsPerClient) {
      this.sendError(socketId, 'MAX_ROOMS_REACHED', 'Exceeded maximum allowed joined rooms', roomId)
      return
    }

    // Authorization check
    try {
      const authorized = await this.options.canJoinRoom(user, roomId)
      if (!authorized) {
        this.sendError(socketId, 'FORBIDDEN', 'Access to room is not authorized', roomId)
        return
      }
    } catch {
      this.sendError(socketId, 'AUTH_ERROR', 'Authorization check failed for room', roomId)
      return
    }

    // Initialize or get room
    let room = this.rooms.get(roomId)
    if (!room) {
      room = {
        id: roomId,
        members: new Set(),
        state: new Map(),
        presence: new Map(),
        sequence: 0,
      }
      this.rooms.set(roomId, room)
    }

    room.members.add(socketId)
    clientRooms?.add(roomId)

    // Register presence
    const now = Date.now()
    const presenceRecord: PresenceRecord = {
      clientId: socketId,
      userId: user?.id,
      userName: user?.name,
      joinedAt: now,
      updatedAt: now,
      data: initialPresence ?? {},
    }
    room.presence.set(socketId, presenceRecord)

    // Build current state dictionary
    const stateRecord: Record<string, unknown> = {}
    const stateVersions: Record<string, number> = {}
    for (const [key, entry] of room.state.entries()) {
      stateRecord[key] = entry.value
      stateVersions[key] = entry.version
    }

    // Build current presence dictionary
    const presenceDict: Record<string, PresenceRecord> = {}
    for (const [cId, pres] of room.presence.entries()) {
      presenceDict[cId] = pres
    }

    const joinedPayload: ServerRoomJoinedPayload = {
      roomId,
      sequence: room.sequence,
      state: stateRecord,
      stateVersions,
      presence: presenceDict,
    }

    this.sendToSocket(socketId, {
      type: 'room_joined',
      payload: joinedPayload,
    })

    // Broadcast presence update to existing room members
    this.broadcastToRoom(
      roomId,
      {
        type: 'presence_updated',
        payload: {
          roomId,
          clientId: socketId,
          record: presenceRecord,
        },
      },
      socketId
    )
  }

  private handleLeaveRoom(socketId: string, payload?: ClientLeaveRoomPayload): void {
    if (!payload?.roomId) return
    this.leaveRoomInternal(socketId, payload.roomId)
    this.sendToSocket(socketId, {
      type: 'room_left',
      payload: { roomId: payload.roomId },
    })
  }

  private leaveRoomInternal(socketId: string, roomId: string): void {
    const room = this.rooms.get(roomId)
    if (!room) return

    room.members.delete(socketId)
    room.presence.delete(socketId)
    this.clientRooms.get(socketId)?.delete(roomId)

    this.broadcastToRoom(roomId, {
      type: 'presence_left',
      payload: { roomId, clientId: socketId },
    })

    // Prune empty rooms
    if (room.members.size === 0) {
      this.rooms.delete(roomId)
    }
  }

  private handleUpdatePresence(
    socketId: string,
    payload?: ClientUpdatePresencePayload
  ): void {
    if (!payload?.roomId || !payload.presence) return
    const room = this.rooms.get(payload.roomId)
    if (!room || !room.members.has(socketId)) return

    const now = Date.now()
    const existing = room.presence.get(socketId)
    const user = this.clientUsers.get(socketId)

    const updatedRecord: PresenceRecord = {
      clientId: socketId,
      userId: user?.id,
      userName: user?.name,
      joinedAt: existing?.joinedAt ?? now,
      updatedAt: now,
      data: { ...(existing?.data ?? {}), ...payload.presence },
    }

    room.presence.set(socketId, updatedRecord)

    this.broadcastToRoom(payload.roomId, {
      type: 'presence_updated',
      payload: {
        roomId: payload.roomId,
        clientId: socketId,
        record: updatedRecord,
      },
    })
  }

  private handleStatePatch(
    socketId: string,
    payload?: ClientStatePatchPayload
  ): void {
    if (!payload?.roomId || !payload.key) {
      this.sendError(socketId, 'INVALID_PATCH', 'roomId and key are required')
      return
    }

    const { roomId, key, value, expectedVersion } = payload
    const room = this.rooms.get(roomId)
    if (!room || !room.members.has(socketId)) {
      this.sendError(socketId, 'NOT_IN_ROOM', 'Must join room before updating state', roomId)
      return
    }

    const currentEntry = room.state.get(key)
    const now = Date.now()
    const user = this.clientUsers.get(socketId)

    // Deterministic optimistic concurrency check
    if (expectedVersion !== undefined && currentEntry && currentEntry.version !== expectedVersion) {
      this.sendError(
        socketId,
        'VERSION_CONFLICT',
        `Version conflict on key "${key}". Expected ${expectedVersion}, got ${currentEntry.version}.`,
        roomId
      )
      return
    }

    // Last-Write-Wins (LWW) resolution: version increments monotonically
    const nextVersion = (currentEntry?.version ?? 0) + 1
    room.sequence++

    const newEntry: RoomStateEntry = {
      value,
      version: nextVersion,
      updatedAt: now,
      updatedBy: user?.id ?? socketId,
    }

    room.state.set(key, newEntry)

    const updatePayload: ServerStateUpdatedPayload = {
      roomId,
      key,
      value,
      version: nextVersion,
      updatedAt: now,
      updatedBy: newEntry.updatedBy,
      sequence: room.sequence,
    }

    // Broadcast updated key to all members in the room
    this.broadcastToRoom(roomId, {
      type: 'state_updated',
      payload: updatePayload,
    })
  }

  private handleSyncRequest(
    socketId: string,
    payload?: ClientSyncRequestPayload
  ): void {
    if (!payload?.roomId) return
    const room = this.rooms.get(payload.roomId)
    if (!room || !room.members.has(socketId)) return

    const stateRecord: Record<string, unknown> = {}
    const stateVersions: Record<string, number> = {}
    for (const [k, v] of room.state.entries()) {
      stateRecord[k] = v.value
      stateVersions[k] = v.version
    }

    this.sendToSocket(socketId, {
      type: 'state_synced',
      payload: {
        roomId: payload.roomId,
        sequence: room.sequence,
        state: stateRecord,
        stateVersions,
      },
    })
  }

  private async handleBroadcast(
    socketId: string,
    payload?: ClientBroadcastPayload
  ): Promise<void> {
    if (!payload?.roomId || !payload.event) {
      this.sendError(socketId, 'INVALID_BROADCAST', 'roomId and event are required')
      return
    }

    const { roomId, event, payload: eventData, messageId } = payload
    const room = this.rooms.get(roomId)
    if (!room || !room.members.has(socketId)) {
      this.sendError(socketId, 'NOT_IN_ROOM', 'Must join room before broadcasting events', roomId)
      return
    }

    const user = this.clientUsers.get(socketId) ?? null

    try {
      const authorized = await this.options.canPublish(user, roomId, event)
      if (!authorized) {
        this.sendError(socketId, 'FORBIDDEN_PUBLISH', `Not permitted to publish event "${event}"`, roomId)
        return
      }
    } catch {
      this.sendError(socketId, 'AUTH_ERROR', 'Publish authorization failed', roomId)
      return
    }

    const now = Date.now()
    const broadcastPayload: ServerBroadcastPayload = {
      roomId,
      event,
      payload: eventData,
      senderId: socketId,
      messageId: messageId ?? `msg_${now}_${Math.random().toString(36).substring(2, 8)}`,
      timestamp: now,
    }

    this.broadcastToRoom(
      roomId,
      {
        type: 'broadcast_event',
        payload: broadcastPayload,
      },
      socketId
    )
  }

  // --- Utility & Broadcast methods ---

  /**
   * Broadcasts a wire message to all members of a given room, optionally excluding the sender.
   */
  public broadcastToRoom(
    roomId: string,
    message: RealtimeWireMessage,
    excludeSocketId?: string
  ): void {
    const room = this.rooms.get(roomId)
    if (!room) return

    const raw = JSON.stringify(message)
    for (const memberId of room.members) {
      if (memberId === excludeSocketId) continue
      const socket = this.sockets.get(memberId)
      if (socket) {
        try {
          socket.send(raw)
        } catch {
          // Socket write errors are logged safely without exposing payload
          logger.warn(`Failed to dispatch message to socket ${memberId} in room ${roomId}`)
        }
      }
    }

    try {
      sharedMetrics.counter('realtime_messages_total').inc({
        direction: 'out',
        type: message.type,
      })
    } catch {
      // Metric errors ignored
    }
  }

  /**
   * Sends a typed wire message to a specific connected socket.
   */
  public sendToSocket(socketId: string, message: RealtimeWireMessage): boolean {
    const socket = this.sockets.get(socketId)
    if (!socket) return false

    try {
      socket.send(JSON.stringify(message))
      try {
        sharedMetrics.counter('realtime_messages_total').inc({
          direction: 'out',
          type: message.type,
        })
      } catch {
        // Metric errors ignored
      }
      return true
    } catch {
      logger.warn(`Failed to send message to socket ${socketId}`)
      return false
    }
  }

  /**
   * Sends a structured error message to a socket.
   */
  public sendError(socketId: string, code: string, message: string, roomId?: string): void {
    this.sendToSocket(socketId, {
      type: 'room_error',
      payload: { code, message, roomId },
    })
  }

  /**
   * Returns a complete state snapshot of a room if it exists.
   */
  public getRoomSnapshot(roomId: string): RoomSnapshot | null {
    const room = this.rooms.get(roomId)
    if (!room) return null

    const stateObj: Record<string, RoomStateEntry<unknown>> = {}
    for (const [k, v] of room.state.entries()) {
      stateObj[k] = v
    }

    const presenceObj: Record<string, PresenceRecord> = {}
    for (const [k, v] of room.presence.entries()) {
      presenceObj[k] = v
    }

    return {
      roomId,
      sequence: room.sequence,
      state: stateObj,
      presence: presenceObj,
    }
  }

  /**
   * Gracefully shuts down the server, notifying all connected sockets and cleaning up state.
   */
  public shutdown(reason: string = 'Server shutting down'): void {
    this.isShuttingDown = true
    const shutdownMessage = JSON.stringify({
      type: 'server_shutdown',
      payload: { reason, timestamp: Date.now() },
    })

    for (const socket of this.sockets.values()) {
      try {
        socket.send(shutdownMessage)
        socket.close(1001, reason)
      } catch {
        // Ignore errors during shutdown close
      }
    }

    this.sockets.clear()
    this.clientUsers.clear()
    this.clientRooms.clear()
    this.rooms.clear()
    this.rateLimits.clear()
    this.seenMessageIds.clear()

    try {
      sharedMetrics.gauge('realtime_connections_active').set({}, 0)
    } catch {
      // Ignored
    }
  }

  private cleanupOldDedupKeys(now: number): void {
    if (this.seenMessageIds.size > 2000) {
      for (const [msgId, timestamp] of this.seenMessageIds.entries()) {
        if (now - timestamp > this.options.dedupCacheTtlMs) {
          this.seenMessageIds.delete(msgId)
        }
      }
    }
  }
}
