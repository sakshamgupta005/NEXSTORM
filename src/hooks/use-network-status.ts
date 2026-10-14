'use client'

import { useState, useEffect } from 'react'
import { NetworkStatus } from '@/lib/pwa/types'

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>(() => {
    if (typeof window === 'undefined') {
      return { isOnline: true, wasOffline: false }
    }
    return {
      isOnline: navigator.onLine,
      wasOffline: false,
    }
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleOnline = () => {
      setStatus((prev) => ({
        ...prev,
        isOnline: true,
        wasOffline: true,
        since: new Date(),
      }))
    }

    const handleOffline = () => {
      setStatus((prev) => ({
        ...prev,
        isOnline: false,
        since: new Date(),
      }))
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return status
}
