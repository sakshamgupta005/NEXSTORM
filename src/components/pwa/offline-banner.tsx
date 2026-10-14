'use client'

import React from 'react'
import { useNetworkStatus } from '@/hooks/use-network-status'
import { useOfflineQueue } from '@/hooks/use-offline-queue'
import { Button } from '@/components/ui/button'

interface OfflineBannerProps {
  className?: string
  showPendingQueue?: boolean
}

export function OfflineBanner({ className = '', showPendingQueue = true }: OfflineBannerProps) {
  const { isOnline } = useNetworkStatus()
  const { pendingCount, processQueue } = useOfflineQueue()

  if (isOnline && pendingCount === 0) {
    return null
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`w-full px-4 py-2.5 text-sm font-medium flex items-center justify-between transition-colors ${
        !isOnline
          ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-b border-amber-500/20'
          : 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-b border-blue-500/20'
      } ${className}`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`inline-block w-2.5 h-2.5 rounded-full ${
            !isOnline ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
          }`}
        />
        <span>
          {!isOnline
            ? 'You are currently offline. Changes will be saved locally and queued for synchronization.'
            : `${pendingCount} action${pendingCount > 1 ? 's' : ''} queued for sync.`}
        </span>
      </div>

      {showPendingQueue && pendingCount > 0 && isOnline && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => processQueue()}
          className="h-7 text-xs border-blue-500/30 hover:bg-blue-500/10"
        >
          Sync Now ({pendingCount})
        </Button>
      )}
    </div>
  )
}
