/**
 * Core type definitions for Progressive Web App (PWA) and offline synchronization.
 */

export interface PwaConfig {
  enabled: boolean
  appName: string
  shortName: string
  themeColor: string
  backgroundColor: string
  display: 'standalone' | 'minimal-ui' | 'fullscreen' | 'browser'
  cacheName: string
  swPath: string
  offlineFallbackUrl: string
  excludedApiPrefixes: string[]
}

export interface NetworkStatus {
  isOnline: boolean
  wasOffline: boolean
  since?: Date
  effectiveType?: 'slow-2g' | '2g' | '3g' | '4g'
  downlink?: number
  rtt?: number
}

export type OfflineActionStatus = 'pending' | 'syncing' | 'synced' | 'failed'

export interface OfflineAction<T = unknown> {
  id: string
  url: string
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: T
  headers?: Record<string, string>
  idempotencyKey: string
  createdAt: number
  attempts: number
  maxRetries: number
  status: OfflineActionStatus
  error?: string
}

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
  prompt(): Promise<void>
}

export interface IdbRecord<T = unknown> {
  key: string
  value: T
  updatedAt: number
}
