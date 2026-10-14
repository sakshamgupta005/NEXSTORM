/**
 * PWA and offline cache configuration settings.
 */

import { PwaConfig } from './types'

export const DEFAULT_PWA_CONFIG: PwaConfig = {
  enabled: process.env.NEXT_PUBLIC_PWA_ENABLED === 'true',
  appName: process.env.NEXT_PUBLIC_APP_NAME || 'Hackathon Starter',
  shortName: 'Starter',
  themeColor: '#2563eb', // blue-600
  backgroundColor: '#ffffff',
  display: 'standalone',
  cacheName: 'hackathon-pwa-v1',
  swPath: '/sw.js',
  offlineFallbackUrl: '/offline.html',
  excludedApiPrefixes: [
    '/api/',
    '/auth/',
    'supabase.co',
    '/dashboard/admin',
  ],
}

/**
 * Checks whether PWA and service worker functionality is enabled by environment.
 */
export function isPwaEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PWA_ENABLED === 'true'
}

/**
 * Determines whether a URL is excluded from offline caching (e.g. private APIs, auth).
 */
export function isExcludedFromCache(url: string, excludedPrefixes = DEFAULT_PWA_CONFIG.excludedApiPrefixes): boolean {
  if (!url) return false
  return excludedPrefixes.some((prefix) => url.includes(prefix))
}
