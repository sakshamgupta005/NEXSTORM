import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ErrorBoundary from '@/app/error'
import GlobalError from '@/app/global-error'

describe('Error Boundaries', () => {
  it('renders root ErrorBoundary with recovery CTA and triggers reset callback', () => {
    const handleReset = vi.fn()
    const error = new Error('Test application crash')

    render(<ErrorBoundary error={error} reset={handleReset} />)

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Something went wrong')
    expect(screen.getByText(/unexpected application error occurred/i)).toBeInTheDocument()

    const retryBtn = screen.getByRole('button', { name: /try again/i })
    expect(retryBtn).toBeInTheDocument()

    fireEvent.click(retryBtn)
    expect(handleReset).toHaveBeenCalledTimes(1)
  })

  it('renders GlobalError boundary and triggers reset callback', () => {
    const handleReset = vi.fn()
    const error = new Error('Fatal layout crash')

    render(<GlobalError error={error} reset={handleReset} />)

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Fatal application error')
    expect(screen.getByText(/critical system error occurred/i)).toBeInTheDocument()

    const retryBtn = screen.getByRole('button', { name: /try again/i })
    fireEvent.click(retryBtn)
    expect(handleReset).toHaveBeenCalledTimes(1)
  })
})
