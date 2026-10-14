'use client'

import * as React from 'react'
import {
  AnnouncerContextValue,
  LiveAnnouncementPriority,
} from './types'

const AnnouncerContext = React.createContext<AnnouncerContextValue | null>(null)

export interface LiveAnnouncerProps {
  children: React.ReactNode
}

export function LiveAnnouncer({ children }: LiveAnnouncerProps) {
  const [politeMessage, setPoliteMessage] = React.useState('')
  const [assertiveMessage, setAssertiveMessage] = React.useState('')

  const announce = React.useCallback(
    (message: string, priority: LiveAnnouncementPriority = 'polite') => {
      if (!message.trim()) return

      if (priority === 'assertive') {
        // Clear first to trigger change detection in screen readers
        setAssertiveMessage('')
        setTimeout(() => setAssertiveMessage(message), 50)
      } else {
        setPoliteMessage('')
        setTimeout(() => setPoliteMessage(message), 50)
      }
    },
    []
  )

  const clear = React.useCallback(() => {
    setPoliteMessage('')
    setAssertiveMessage('')
  }, [])

  const contextValue = React.useMemo(
    () => ({ announce, clear }),
    [announce, clear]
  )

  return (
    <AnnouncerContext.Provider value={contextValue}>
      {children}

      {/* Screen reader live regions */}
      <div
        id="a11y-announcer-polite"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-testid="announcer-polite"
      >
        {politeMessage}
      </div>

      <div
        id="a11y-announcer-assertive"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
        data-testid="announcer-assertive"
      >
        {assertiveMessage}
      </div>
    </AnnouncerContext.Provider>
  )
}

export function useAnnounce(): AnnouncerContextValue {
  const context = React.useContext(AnnouncerContext)
  if (!context) {
    return {
      announce: (message: string) => {
        // Fallback: log for debugging if announcer wrapper omitted
        if (process.env.NODE_ENV === 'development') {
          console.debug('[a11y announcer]:', message)
        }
      },
      clear: () => {},
    }
  }
  return context
}
