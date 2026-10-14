/**
 * Reusable Realtime Collaboration & Shared State Types
 * 
 * References: Socket.IO, Yjs, Liveblocks, PartyKit
 * 
 * Provides:
 * - Realtime transport messages and wire protocol types
 * - Ephemeral presence data structures
 * - Versioned room shared state and conflict resolution types
 * - Room membership, broadcast, and authorization definitions
 */

export type RealtimeConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error'

/** Authenticated user identity attached to a realtime connection */
export interface RealtimeUser {
  id: string
  name?: string
  role?: string
  metadata?: Record<string, unknown>
}

/** Ephemeral presence record for a participant in a room */
export interface PresenceRecord<T = Record<string, unknown>> {
  clientId: string
  userId?: string
  userName?: string
  joinedAt: number
  updatedAt: number
  data: T
}

/** Individual key-value entry in a room's shared state store */
export interface RoomStateEntry<T = unknown> {
  value: T
  version: number
  updatedAt: number
  updatedBy?: string
}

/** Snapshot of room state and presence returned on initial join or resync */
export interface RoomSnapshot<
  TState = Record<string, unknown>,
  TPresence = Record<string, unknown>
> {
  roomId: string
  sequence: number
  state: Record<keyof TState & string, RoomStateEntry<unknown>>
  presence: Record<string, PresenceRecord<TPresence>>
}

/** Abstract bidirectional socket connection */
export interface ISocketConnection {
  id: string
  send: (data: string) => void
  close: (code?: number, reason?: string) => void
}

/** Wire message sent between client and server */
export interface RealtimeWireMessage<T = unknown> {
  type: string
  payload?: T
  id?: string
  timestamp?: number
}

// Client-to-Server Payload Types
export interface ClientAuthPayload {
  token?: string
  clientMetadata?: Record<string, unknown>
}

export interface ClientJoinRoomPayload {
  roomId: string
  initialPresence?: Record<string, unknown>
}

export interface ClientLeaveRoomPayload {
  roomId: string
}

export interface ClientUpdatePresencePayload {
  roomId: string
  presence: Record<string, unknown>
}

export interface ClientStatePatchPayload {
  roomId: string
  key: string
  value: unknown
  expectedVersion?: number
}

export interface ClientSyncRequestPayload {
  roomId: string
  knownSequence?: number
}

export interface ClientBroadcastPayload {
  roomId: string
  event: string
  payload: unknown
  messageId?: string
}

// Server-to-Client Payload Types
export interface ServerAuthenticatedPayload {
  clientId: string
  user?: RealtimeUser
}

export interface ServerRoomJoinedPayload {
  roomId: string
  sequence: number
  state: Record<string, unknown>
  stateVersions: Record<string, number>
  presence: Record<string, PresenceRecord>
}

export interface ServerPresenceUpdatedPayload {
  roomId: string
  clientId: string
  record: PresenceRecord
}

export interface ServerPresenceLeftPayload {
  roomId: string
  clientId: string
}

export interface ServerStateUpdatedPayload {
  roomId: string
  key: string
  value: unknown
  version: number
  updatedAt: number
  updatedBy?: string
  sequence: number
}

export interface ServerStateSyncedPayload {
  roomId: string
  sequence: number
  state: Record<string, unknown>
  stateVersions: Record<string, number>
}

export interface ServerBroadcastPayload {
  roomId: string
  event: string
  payload: unknown
  senderId: string
  messageId: string
  timestamp: number
}

export interface ServerErrorPayload {
  code: string
  message: string
  roomId?: string
}

export interface ServerShutdownPayload {
  reason: string
  timestamp: number
}

/** Realtime Server Configuration Options */
export interface RealtimeServerOptions {
  /** Maximum allowable message size in bytes before rejecting (default: 65536 = 64KB) */
  maxMessageSizeBytes?: number
  /** Maximum messages per second allowed per client (default: 50) */
  rateLimitPerSecond?: number
  /** Maximum rooms a single client can join simultaneously (default: 50) */
  maxRoomsPerClient?: number
  /** Message deduplication cache time-to-live in milliseconds (default: 60000 = 60s) */
  dedupCacheTtlMs?: number
  /** Optional custom token authenticator */
  authenticate?: (token?: string) => Promise<RealtimeUser | null> | RealtimeUser | null
  /** Optional room access authorization hook */
  canJoinRoom?: (user: RealtimeUser | null, roomId: string) => Promise<boolean> | boolean
  /** Optional event publish authorization hook */
  canPublish?: (user: RealtimeUser | null, roomId: string, event: string) => Promise<boolean> | boolean
}
