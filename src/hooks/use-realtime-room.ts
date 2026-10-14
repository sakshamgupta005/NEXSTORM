'use client'

/**
 * Reusable React Hook for Realtime Room Collaboration & Shared State
 * 
 * References: Liveblocks (useRoom, useOthers, useStorage), PartyKit (usePartySocket)
 * 
 * Capabilities:
 * - Reactive state synchronization and presence tracking
 * - Optimistic presence updates and state key mutators
 * - Automatic room join/leave lifecycle bound to React component tree
 * - Disconnect / reconnect status tracking and error handling
 */

import * as React from 'react'
import { RealtimeCollaborationClient } from '@/lib/realtime/collaboration-client'
import type {
  RealtimeConnectionStatus,
  PresenceRecord,
} from '@/lib/realtime/collaboration-types'

export interface UseRealtimeRoomOptions<
  TState = Record<string, unknown>,
  TPresence = Record<string, unknown>
> {
  roomId: string
  client: RealtimeCollaborationClient
  initialState?: TState
  initialPresence?: TPresence
  enabled?: boolean
  onEvent?: (event: string, payload: unknown, senderId: string) => void
  onError?: (error: { code: string; message: string; roomId?: string }) => void
}

export interface UseRealtimeRoomResult<
  TState = Record<string, unknown>,
  TPresence = Record<string, unknown>
> {
  status: RealtimeConnectionStatus
  isConnected: boolean
  state: TState
  presence: Record<string, PresenceRecord<TPresence>>
  myPresence: TPresence | undefined
  updatePresence: (patch: Partial<TPresence>) => void
  setStateKey: (key: string, value: unknown, expectedVersion?: number) => void
  broadcast: (event: string, payload: unknown) => void
  requestSync: () => void
  error: string | null
}

export function useRealtimeRoom<
  TState = Record<string, unknown>,
  TPresence = Record<string, unknown>
>(options: UseRealtimeRoomOptions<TState, TPresence>): UseRealtimeRoomResult<TState, TPresence> {
  const { roomId, client, initialPresence, enabled = true, onEvent, onError } = options

  const [status, setStatus] = React.useState<RealtimeConnectionStatus>(client.getStatus())
  const [state, setState] = React.useState<TState>((client.getRoomState<TState>(roomId) ?? {}) as TState)
  const [presence, setPresence] = React.useState<Record<string, PresenceRecord<TPresence>>>(
    (client.getRoomPresence(roomId) ?? {}) as Record<string, PresenceRecord<TPresence>>
  )
  const [myPresence, setMyPresence] = React.useState<TPresence | undefined>(initialPresence)
  const [error, setError] = React.useState<string | null>(null)

  const onEventRef = React.useRef(onEvent)
  const onErrorRef = React.useRef(onError)

  React.useEffect(() => {
    onEventRef.current = onEvent
    onErrorRef.current = onError
  })

  React.useEffect(() => {
    if (!enabled || !roomId) return

    // Bind connection status listener
    const unbindStatus: () => void = client.onStatusChange((newStatus) => {
      setStatus(newStatus)
      if (newStatus === 'connected') {
        setError(null)
      }
    })

    // Bind state listener
    const unbindState: () => void = client.onRoomState(roomId, (newState) => {
      setState(newState as TState)
    })

    // Bind presence listener
    const unbindPresence: () => void = client.onRoomPresence(roomId, (newPresence) => {
      setPresence(newPresence as Record<string, PresenceRecord<TPresence>>)
    })

    // Bind error listener
    const unbindError: () => void = client.onError((err) => {
      if (!err.roomId || err.roomId === roomId) {
        setError(err.message)
        onErrorRef.current?.(err)
      }
    })

    // Join room with initial presence
    client.joinRoom(
      roomId,
      initialPresence as Record<string, unknown> | undefined
    )

    return () => {
      unbindStatus()
      unbindState()
      unbindPresence()
      unbindError()
      client.leaveRoom(roomId)
    }
  }, [roomId, client, enabled, initialPresence])

  const updatePresence = React.useCallback(
    (patch: Partial<TPresence>) => {
      setMyPresence((prev) => {
        const next = { ...(prev ?? {}), ...patch } as TPresence
        client.updatePresence(roomId, next as Record<string, unknown>)
        return next
      })
    },
    [client, roomId]
  )

  const setStateKey = React.useCallback(
    (key: string, value: unknown, expectedVersion?: number) => {
      client.setStateKey(roomId, key, value, expectedVersion)
    },
    [client, roomId]
  )

  const broadcast = React.useCallback(
    (event: string, payload: unknown) => {
      client.broadcast(roomId, event, payload)
    },
    [client, roomId]
  )

  const requestSync = React.useCallback(() => {
    client.requestSync(roomId)
  }, [client, roomId])

  return {
    status,
    isConnected: status === 'connected',
    state,
    presence,
    myPresence,
    updatePresence,
    setStateKey,
    broadcast,
    requestSync,
    error,
  }
}
