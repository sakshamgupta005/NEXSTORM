import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  RealtimeServer,
  RealtimeCollaborationClient,
  type ISocketConnection,
  type RealtimeWireMessage,
} from '@/lib/realtime'

// In-memory mock socket implementation for testing
class TestSocket implements ISocketConnection {
  public id: string
  public sentMessages: string[] = []
  public closed = false
  public closeCode?: number
  public closeReason?: string

  constructor(id: string) {
    this.id = id
  }

  send(data: string) {
    this.sentMessages.push(data)
  }

  close(code?: number, reason?: string) {
    this.closed = true
    this.closeCode = code
    this.closeReason = reason
  }

  getLastMessage<T = unknown>(): RealtimeWireMessage<T> | null {
    if (this.sentMessages.length === 0) return null
    return JSON.parse(this.sentMessages[this.sentMessages.length - 1]) as RealtimeWireMessage<T>
  }

  getAllMessages(): RealtimeWireMessage[] {
    return this.sentMessages.map((m) => JSON.parse(m) as RealtimeWireMessage)
  }

  clear() {
    this.sentMessages = []
  }
}

describe('Realtime Collaboration Toolkit', () => {
  let server: RealtimeServer

  beforeEach(() => {
    vi.clearAllMocks()
    server = new RealtimeServer({
      maxMessageSizeBytes: 1024, // 1KB limit for testing
      rateLimitPerSecond: 5,
      authenticate: async (token) => {
        if (token === 'valid_jwt_alice') {
          return { id: 'u_alice', name: 'Alice', role: 'admin' }
        }
        if (token === 'valid_jwt_bob') {
          return { id: 'u_bob', name: 'Bob', role: 'member' }
        }
        return null
      },
      canJoinRoom: (user, roomId) => {
        if (roomId.startsWith('private:') && !user) return false
        if (roomId === 'private:admins-only' && user?.role !== 'admin') return false
        return true
      },
      canPublish: (user, _roomId, event) => {
        if (event === 'admin_alert' && user?.role !== 'admin') return false
        return true
      },
    })
  })

  it('handles connection, authentication, and disconnection lifecycle', async () => {
    const socket = new TestSocket('sock_1')
    await server.registerConnection(socket, { token: 'valid_jwt_alice' })

    const lastMsg = socket.getLastMessage<{ clientId: string; user?: { id: string } }>()
    expect(lastMsg?.type).toBe('authenticated')
    expect(lastMsg?.payload?.clientId).toBe('sock_1')
    expect(lastMsg?.payload?.user?.id).toBe('u_alice')

    // Disconnect
    server.unregisterConnection('sock_1')
  })

  it('rejects unauthenticated or unauthorized access to protected rooms', async () => {
    const anonSocket = new TestSocket('sock_anon')
    await server.registerConnection(anonSocket)

    // Attempt to join private room without auth
    await server.handleMessage(
      'sock_anon',
      JSON.stringify({
        type: 'join_room',
        payload: { roomId: 'private:secret-room' },
      })
    )

    const errorMsg = anonSocket.getLastMessage<{ code: string }>()
    expect(errorMsg?.type).toBe('room_error')
    expect(errorMsg?.payload?.code).toBe('FORBIDDEN')

    // Bob (regular member) attempting to join admin-only room
    const bobSocket = new TestSocket('sock_bob')
    await server.registerConnection(bobSocket, { token: 'valid_jwt_bob' })

    await server.handleMessage(
      'sock_bob',
      JSON.stringify({
        type: 'join_room',
        payload: { roomId: 'private:admins-only' },
      })
    )

    const bobError = bobSocket.getLastMessage<{ code: string }>()
    expect(bobError?.type).toBe('room_error')
    expect(bobError?.payload?.code).toBe('FORBIDDEN')
  })

  it('allows authorized users to join rooms, sync initial state, and track presence', async () => {
    const aliceSocket = new TestSocket('sock_alice')
    await server.registerConnection(aliceSocket, { token: 'valid_jwt_alice' })

    await server.handleMessage(
      'sock_alice',
      JSON.stringify({
        type: 'join_room',
        payload: {
          roomId: 'room_whiteboard',
          initialPresence: { cursor: { x: 10, y: 20 }, status: 'editing' },
        },
      })
    )

    const joinMsg = aliceSocket.getLastMessage<{
      roomId: string
      presence: Record<string, { data: { status: string } }>
    }>()
    expect(joinMsg?.type).toBe('room_joined')
    expect(joinMsg?.payload?.roomId).toBe('room_whiteboard')
    expect(joinMsg?.payload?.presence['sock_alice'].data.status).toBe('editing')

    // Bob joins same room and verifies presence broadcast
    const bobSocket = new TestSocket('sock_bob')
    await server.registerConnection(bobSocket, { token: 'valid_jwt_bob' })
    aliceSocket.clear()

    await server.handleMessage(
      'sock_bob',
      JSON.stringify({
        type: 'join_room',
        payload: {
          roomId: 'room_whiteboard',
          initialPresence: { cursor: { x: 50, y: 60 } },
        },
      })
    )

    // Alice should receive presence_updated for Bob
    const alicePresenceMsg = aliceSocket.getLastMessage<{
      clientId: string
      record: { data: { cursor: { x: number } } }
    }>()
    expect(alicePresenceMsg?.type).toBe('presence_updated')
    expect(alicePresenceMsg?.payload?.clientId).toBe('sock_bob')
    expect(alicePresenceMsg?.payload?.record.data.cursor.x).toBe(50)
  })

  it('enforces Last-Write-Wins (LWW) and version conflict checks on shared state', async () => {
    const socketA = new TestSocket('sock_a')
    const socketB = new TestSocket('sock_b')
    await server.registerConnection(socketA, { token: 'valid_jwt_alice' })
    await server.registerConnection(socketB, { token: 'valid_jwt_bob' })

    await server.handleMessage(
      'sock_a',
      JSON.stringify({ type: 'join_room', payload: { roomId: 'collab_doc' } })
    )
    await server.handleMessage(
      'sock_b',
      JSON.stringify({ type: 'join_room', payload: { roomId: 'collab_doc' } })
    )
    socketB.clear()

    // Socket A patches key "title"
    await server.handleMessage(
      'sock_a',
      JSON.stringify({
        type: 'state_patch',
        payload: { roomId: 'collab_doc', key: 'title', value: 'Project Pitch' },
      })
    )

    const patchMsg = socketB.getLastMessage<{
      key: string
      value: string
      version: number
      sequence: number
    }>()
    expect(patchMsg?.type).toBe('state_updated')
    expect(patchMsg?.payload?.key).toBe('title')
    expect(patchMsg?.payload?.value).toBe('Project Pitch')
    expect(patchMsg?.payload?.version).toBe(1)
    expect(patchMsg?.payload?.sequence).toBe(1)

    // Socket B attempts to update with stale expectedVersion 0 -> VERSION_CONFLICT
    await server.handleMessage(
      'sock_b',
      JSON.stringify({
        type: 'state_patch',
        payload: {
          roomId: 'collab_doc',
          key: 'title',
          value: 'Overwritten',
          expectedVersion: 0,
        },
      })
    )

    const conflictError = socketB.getLastMessage<{ code: string }>()
    expect(conflictError?.type).toBe('room_error')
    expect(conflictError?.payload?.code).toBe('VERSION_CONFLICT')

    // Socket B updates with matching expectedVersion 1 -> Success & LWW version 2
    await server.handleMessage(
      'sock_b',
      JSON.stringify({
        type: 'state_patch',
        payload: {
          roomId: 'collab_doc',
          key: 'title',
          value: 'Confirmed Pitch',
          expectedVersion: 1,
        },
      })
    )

    const successPatch = socketB.getLastMessage<{ version: number; value: string }>()
    expect(successPatch?.type).toBe('state_updated')
    expect(successPatch?.payload?.version).toBe(2)
    expect(successPatch?.payload?.value).toBe('Confirmed Pitch')
  })

  it('rejects oversized payloads and malformed JSON', async () => {
    const socket = new TestSocket('sock_tester')
    await server.registerConnection(socket)

    // 1. Malformed JSON
    await server.handleMessage('sock_tester', '{ not valid json')
    let err = socket.getLastMessage<{ code: string }>()
    expect(err?.type).toBe('room_error')
    expect(err?.payload?.code).toBe('INVALID_JSON')

    // 2. Oversized payload (> 1024 bytes)
    const giantPayload = JSON.stringify({
      type: 'join_room',
      payload: { data: 'a'.repeat(2000) },
    })
    await server.handleMessage('sock_tester', giantPayload)
    err = socket.getLastMessage<{ code: string }>()
    expect(err?.type).toBe('room_error')
    expect(err?.payload?.code).toBe('PAYLOAD_TOO_LARGE')
  })

  it('enforces rate limits on high-frequency messages', async () => {
    const socket = new TestSocket('sock_spammer')
    await server.registerConnection(socket)

    // Rate limit configured to 5 msgs/sec
    for (let i = 0; i < 5; i++) {
      await server.handleMessage('sock_spammer', JSON.stringify({ type: 'ping' }))
    }

    // 6th message should exceed rate limit
    await server.handleMessage('sock_spammer', JSON.stringify({ type: 'ping' }))
    const rateErr = socket.getLastMessage<{ code: string }>()
    expect(rateErr?.type).toBe('room_error')
    expect(rateErr?.payload?.code).toBe('RATE_LIMIT_EXCEEDED')
  })

  it('idempotently deduplicates messages with identical message IDs', async () => {
    const socket = new TestSocket('sock_client')
    await server.registerConnection(socket, { token: 'valid_jwt_alice' })
    await server.handleMessage(
      'sock_client',
      JSON.stringify({ type: 'join_room', payload: { roomId: 'chat_room' } })
    )

    socket.clear()
    const msgId = 'unique_msg_12345'
    const wireMsg = JSON.stringify({
      id: msgId,
      type: 'broadcast',
      payload: { roomId: 'chat_room', event: 'user_typing', payload: { isTyping: true } },
    })

    // First broadcast succeeds
    await server.handleMessage('sock_client', wireMsg)
    const initialSent = socket.sentMessages.length

    // Exact duplicate with same messageId is skipped
    await server.handleMessage('sock_client', wireMsg)
    expect(socket.sentMessages.length).toBe(initialSent)
  })

  it('cleans up presence on user departure and disconnect', async () => {
    const socket1 = new TestSocket('sock_1')
    const socket2 = new TestSocket('sock_2')
    await server.registerConnection(socket1)
    await server.registerConnection(socket2)

    await server.handleMessage(
      'sock_1',
      JSON.stringify({ type: 'join_room', payload: { roomId: 'lobby' } })
    )
    await server.handleMessage(
      'sock_2',
      JSON.stringify({ type: 'join_room', payload: { roomId: 'lobby' } })
    )

    socket2.clear()

    // Socket 1 leaves room
    await server.handleMessage(
      'sock_1',
      JSON.stringify({ type: 'leave_room', payload: { roomId: 'lobby' } })
    )

    const leaveMsg = socket2.getLastMessage<{ clientId: string }>()
    expect(leaveMsg?.type).toBe('presence_left')
    expect(leaveMsg?.payload?.clientId).toBe('sock_1')

    // Socket 2 unregisters -> empty room pruned
    server.unregisterConnection('sock_2')
    expect(server.getRoomSnapshot('lobby')).toBeNull()
  })

  it('notifies all clients and terminates cleanly on graceful shutdown', async () => {
    const socket1 = new TestSocket('sock_1')
    const socket2 = new TestSocket('sock_2')
    await server.registerConnection(socket1)
    await server.registerConnection(socket2)

    server.shutdown('Maintenance restart')

    expect(socket1.closed).toBe(true)
    expect(socket1.closeCode).toBe(1001)
    expect(socket2.closed).toBe(true)

    const shutdownMsg = socket1.getLastMessage<{ reason: string }>()
    expect(shutdownMsg?.type).toBe('server_shutdown')
    expect(shutdownMsg?.payload?.reason).toBe('Maintenance restart')
  })

  it('operates RealtimeCollaborationClient reactive listeners and room caching', async () => {
    const client = new RealtimeCollaborationClient({ authToken: 'valid_jwt_alice' })
    const stateSpy = vi.fn()
    const presenceSpy = vi.fn()
    const eventSpy = vi.fn()

    client.onRoomState('room_1', stateSpy)
    client.onRoomPresence('room_1', presenceSpy)
    client.onRoomEvent('room_1', 'custom_alert', eventSpy)

    // Simulate server room_joined response
    client.receiveMessage({
      type: 'room_joined',
      payload: {
        roomId: 'room_1',
        sequence: 1,
        state: { topic: 'Sprint Planning' },
        stateVersions: { topic: 1 },
        presence: {
          u1: {
            clientId: 'u1',
            joinedAt: Date.now(),
            updatedAt: Date.now(),
            data: { online: true },
          },
        },
      },
    })

    expect(stateSpy).toHaveBeenCalledWith({ topic: 'Sprint Planning' })
    expect(presenceSpy).toHaveBeenCalled()
    expect(client.getRoomState('room_1')).toEqual({ topic: 'Sprint Planning' })

    // Simulate state update from another client
    client.receiveMessage({
      type: 'state_updated',
      payload: {
        roomId: 'room_1',
        key: 'topic',
        value: 'Q4 Roadmap',
        version: 2,
        updatedAt: Date.now(),
        sequence: 2,
      },
    })

    expect(stateSpy).toHaveBeenCalledWith({ topic: 'Q4 Roadmap' })
    expect(client.getRoomState('room_1')).toEqual({ topic: 'Q4 Roadmap' })

    // Simulate broadcast event
    client.receiveMessage({
      type: 'broadcast_event',
      payload: {
        roomId: 'room_1',
        event: 'custom_alert',
        payload: { priority: 'high' },
        senderId: 'sock_peer',
        messageId: 'b_msg_999',
        timestamp: Date.now(),
      },
    })

    expect(eventSpy).toHaveBeenCalledWith({ priority: 'high' }, 'sock_peer', 'b_msg_999')

    // Clean disposal
    client.dispose()
    expect(client.getStatus()).toBe('disconnected')
  })
})
