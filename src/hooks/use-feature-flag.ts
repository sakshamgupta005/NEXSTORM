'use client'

import { useState, useEffect } from 'react'
import type { EvaluationContext } from '@/lib/config/types'
import { featureFlagManager } from '@/lib/config/flags'

/**
 * Reusable React Hook for querying feature flag status on the frontend.
 * 
 * Note: Feature flags on the client toggle UI elements only.
 * Always enforce authentication, authorization, and business rules on the server!
 */
export function useFeatureFlag(
  flagKey: string,
  options: {
    context?: EvaluationContext
    defaultValue?: boolean
  } = {}
): boolean {
  const { context, defaultValue = false } = options

  const [isEnabled, setIsEnabled] = useState<boolean>(() => {
    // Initial evaluation
    try {
      return featureFlagManager.isEnabled(flagKey, context)
    } catch {
      return defaultValue
    }
  })

  useEffect(() => {
    const checkState = () => {
      try {
        const active = featureFlagManager.isEnabled(flagKey, context)
        setIsEnabled(active)
      } catch {
        setIsEnabled(defaultValue)
      }
    }

    checkState()
    return featureFlagManager.subscribe(checkState)
  }, [flagKey, context, defaultValue])

  return isEnabled
}
