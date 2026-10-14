import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  LoadingState,
  EmptyState,
  ErrorState,
  SuccessState,
} from '@/components/ui/state-views'

describe('Reusable UI State Views', () => {
  it('renders LoadingState with custom title and description', () => {
    render(<LoadingState title="Analyzing codebase..." description="Please wait" />)
    expect(screen.getByTestId('loading-state')).toBeInTheDocument()
    expect(screen.getByText('Analyzing codebase...')).toBeInTheDocument()
    expect(screen.getByText('Please wait')).toBeInTheDocument()
  })

  it('renders EmptyState and triggers action callback when button is clicked', () => {
    const handleAction = vi.fn()
    render(
      <EmptyState
        title="No documents yet"
        description="Upload a document to begin"
        actionLabel="Upload Now"
        onAction={handleAction}
      />
    )
    expect(screen.getByTestId('empty-state')).toBeInTheDocument()
    expect(screen.getByText('No documents yet')).toBeInTheDocument()
    
    const actionBtn = screen.getByRole('button', { name: 'Upload Now' })
    fireEvent.click(actionBtn)
    expect(handleAction).toHaveBeenCalledTimes(1)
  })

  it('renders ErrorState with action button', () => {
    const handleRetry = vi.fn()
    render(
      <ErrorState
        title="Search failed"
        description="Network error"
        actionLabel="Retry Search"
        onAction={handleRetry}
      />
    )
    expect(screen.getByTestId('error-state')).toBeInTheDocument()
    expect(screen.getByText('Search failed')).toBeInTheDocument()
    
    const retryBtn = screen.getByRole('button', { name: 'Retry Search' })
    fireEvent.click(retryBtn)
    expect(handleRetry).toHaveBeenCalledTimes(1)
  })

  it('renders SuccessState with completion text', () => {
    render(<SuccessState title="Generated 5 test cases" description="Saved to tests/" />)
    expect(screen.getByTestId('success-state')).toBeInTheDocument()
    expect(screen.getByText('Generated 5 test cases')).toBeInTheDocument()
  })
})
