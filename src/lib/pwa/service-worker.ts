/**
 * Service Worker registration and lifecycle manager.
 */

import { DEFAULT_PWA_CONFIG, isPwaEnabled } from './config'

export interface SwRegistrationResult {
  registered: boolean
  registration?: ServiceWorkerRegistration
  reason?: string
}

/**
 * Registers the service worker if PWA is enabled by environment, or unregisters existing workers if disabled.
 */
export async function registerServiceWorker(
  swPath = DEFAULT_PWA_CONFIG.swPath
): Promise<SwRegistrationResult> {
  // If PWA is disabled by environment, proactively unregister any active service worker
  if (!isPwaEnabled()) {
    await unregisterServiceWorker()
    return {
      registered: false,
      reason: 'PWA support is disabled by environment (set NEXT_PUBLIC_PWA_ENABLED=true to enable).',
    }
  }

  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return {
      registered: false,
      reason: 'Service Workers are not supported in this browser environment.',
    }
  }

  try {
    const registration = await navigator.serviceWorker.register(swPath, {
      scope: '/',
    })

    // Listen for incoming service worker updates
    registration.addEventListener('updatefound', () => {
      const installingWorker = registration.installing
      if (installingWorker) {
        installingWorker.addEventListener('statechange', () => {
          if (
            installingWorker.state === 'installed' &&
            navigator.serviceWorker.controller
          ) {
            // New version ready
            window.dispatchEvent(new CustomEvent('pwa:update-available'))
          }
        })
      }
    })

    return {
      registered: true,
      registration,
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return {
      registered: false,
      reason: `Failed to register service worker: ${msg}`,
    }
  }
}

/**
 * Unregisters any active service workers and cleans up old PWA caches.
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return false
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations()
    for (const reg of registrations) {
      await reg.unregister()
    }

    // Clean up caches
    if ('caches' in window) {
      const keys = await caches.keys()
      for (const key of keys) {
        if (key.includes('pwa') || key.includes('hackathon')) {
          await caches.delete(key)
        }
      }
    }

    return true
  } catch {
    return false
  }
}

/**
 * Manually checks for service worker updates.
 */
export async function checkForSwUpdates(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return false
  }

  try {
    const reg = await navigator.serviceWorker.getRegistration()
    if (reg) {
      await reg.update()
      return true
    }
    return false
  } catch {
    return false
  }
}
