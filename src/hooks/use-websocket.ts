'use client'

import * as React from 'react'
import {
  WebSocketClient,
  WebSocketStatus,
  WebSocketMessage,
  WebSocketClientOptions,
} from '@/lib/realtime/websocket'

export interface UseWebSocketOptions<TMessage = unknown>
  extends Omit<WebSocketClientOptions, 'url' | 'onMessage' | 'onStatusChange'> {
  enabled?: boolean
  onMessage?: (message: WebSocketMessage<TMessage>) => void
}

export interface UseWebSocketResult<TMessage = unknown> {
  status: WebSocketStatus
  isConnected: boolean
  lastMessage: WebSocketMessage<TMessage> | null
  error: string | null
  send: (data: unknown) => boolean
  connect: () => void
  disconnect: () => void
  reconnect: () => void
}

export function useWebSocket<TMessage = unknown>(
  url: string | null | undefined,
  options: UseWebSocketOptions<TMessage> = {}
): UseWebSocketResult<TMessage> {
  const { enabled = true, onMessage, onOpen, onClose, onError, ...clientOptions } = options

  const [status, setStatus] = React.useState<WebSocketStatus>('closed')
  const [lastMessage, setLastMessage] = React.useState<WebSocketMessage<TMessage> | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const clientRef = React.useRef<WebSocketClient | null>(null)
  const clientOptionsRef = React.useRef(clientOptions)
  const onMessageRef = React.useRef(onMessage)
  const onOpenRef = React.useRef(onOpen)
  const onCloseRef = React.useRef(onClose)
  const onErrorRef = React.useRef(onError)

  React.useEffect(() => {
    clientOptionsRef.current = clientOptions
    onMessageRef.current = onMessage
    onOpenRef.current = onOpen
    onCloseRef.current = onClose
    onErrorRef.current = onError
  })

  // Initialize and bind client lifecycle
  React.useEffect(() => {
    if (!url || !enabled) {
      if (clientRef.current) {
        clientRef.current.dispose()
        clientRef.current = null
      }
      return
    }

    const client = new WebSocketClient({
      url,
      autoConnect: true,
      ...clientOptionsRef.current,
      onStatusChange: (newStatus) => {
        setStatus(newStatus)
        if (newStatus === 'open') {
          setError(null)
        }
      },
      onOpen: (ev) => {
        onOpenRef.current?.(ev)
      },
      onClose: (ev) => {
        onCloseRef.current?.(ev)
      },
      onError: (ev) => {
        setError('WebSocket encountered a network error')
        onErrorRef.current?.(ev)
      },
      onMessage: (msg) => {
        setLastMessage(msg as WebSocketMessage<TMessage>)
        onMessageRef.current?.(msg as WebSocketMessage<TMessage>)
      },
    })

    clientRef.current = client

    return () => {
      client.dispose()
      clientRef.current = null
    }
  }, [url, enabled])

  const send = React.useCallback((data: unknown): boolean => {
    if (clientRef.current) {
      return clientRef.current.send(data)
    }
    return false
  }, [])

  const connect = React.useCallback(() => {
    if (clientRef.current) {
      void clientRef.current.connect()
    }
  }, [])

  const disconnect = React.useCallback(() => {
    if (clientRef.current) {
      clientRef.current.disconnect()
    }
  }, [])

  const reconnect = React.useCallback(() => {
    if (clientRef.current) {
      clientRef.current.disconnect()
      void clientRef.current.connect()
    }
  }, [])

  return {
    status,
    isConnected: status === 'open',
    lastMessage,
    error,
    send,
    connect,
    disconnect,
    reconnect,
  }
}
