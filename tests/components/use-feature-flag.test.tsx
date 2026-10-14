import React from 'react'
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { useFeatureFlag } from '@/hooks/use-feature-flag'
import { featureFlagManager } from '@/lib/config/flags'

function FeatureGatedComponent({ flagKey }: { flagKey: string }) {
  const isEnabled = useFeatureFlag(flagKey, { defaultValue: false })

  return (
    <div>
      <p data-testid="status">{isEnabled ? 'Feature is Active' : 'Feature is Inactive'}</p>
      {isEnabled && <button>Experimental Feature Button</button>}
    </div>
  )
}

describe('useFeatureFlag Component Hook', () => {
  beforeEach(() => {
    featureFlagManager.clearOverrides()
  })

  it('renders default inactive state when flag is unregistered', () => {
    render(<FeatureGatedComponent flagKey="unregistered-feature" />)
    expect(screen.getByTestId('status')).toHaveTextContent('Feature is Inactive')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders active state when flag is registered and enabled', () => {
    featureFlagManager.registerFlag({
      key: 'beta-workspace',
      defaultValue: true,
    })

    render(<FeatureGatedComponent flagKey="beta-workspace" />)
    expect(screen.getByTestId('status')).toHaveTextContent('Feature is Active')
    expect(screen.getByRole('button', { name: /experimental feature button/i })).toBeInTheDocument()
  })

  it('reacts dynamically to feature flag overrides', () => {
    featureFlagManager.registerFlag({
      key: 'dynamic-toggle',
      defaultValue: false,
    })

    const { rerender } = render(<FeatureGatedComponent flagKey="dynamic-toggle" />)
    expect(screen.getByTestId('status')).toHaveTextContent('Feature is Inactive')

    // Apply runtime override and rerender
    act(() => {
      featureFlagManager.setOverride('dynamic-toggle', true)
    })

    rerender(<FeatureGatedComponent flagKey="dynamic-toggle" />)
    expect(screen.getByTestId('status')).toHaveTextContent('Feature is Active')
  })
})
