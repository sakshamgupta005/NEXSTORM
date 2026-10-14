'use client'

import * as React from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

/**
 * Returns true if the user has requested reduced motion at system level.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return false
  }
  return window.matchMedia(QUERY).matches
}

function subscribe(callback: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return () => {}
  }
  const mediaQueryList = window.matchMedia(QUERY)
  if (mediaQueryList.addEventListener) {
    mediaQueryList.addEventListener('change', callback)
    return () => mediaQueryList.removeEventListener('change', callback)
  } else {
    // Deprecated matchMedia fallback
    mediaQueryList.addListener(callback)
    return () => mediaQueryList.removeListener(callback)
  }
}

function getSnapshot(): boolean {
  return prefersReducedMotion()
}

function getServerSnapshot(): boolean {
  return false
}

/**
 * React hook that reactively tracks the user's reduced-motion preference via useSyncExternalStore.
 */
export function usePrefersReducedMotion(): boolean {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
