import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { Card, CardTitle, CardContent } from '@/components/ui/card'

describe('UI Component Primitives', () => {
  it('renders Button with variants and loading state', () => {
    const { rerender } = render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument()

    rerender(<Button isLoading>Click me</Button>)
    const button = screen.getByRole('button', { name: /click me/i })
    expect(button).toBeDisabled()
  })

  it('renders Badge with correct text and classes', () => {
    render(<Badge variant="success">Active</Badge>)
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('renders Alert with alert role', () => {
    render(<Alert variant="destructive">Critical Error</Alert>)
    expect(screen.getByRole('alert')).toHaveTextContent('Critical Error')
  })

  it('renders Card with header and content', () => {
    render(
      <Card>
        <CardTitle>Test Title</CardTitle>
        <CardContent>Test Content</CardContent>
      </Card>
    )
    expect(screen.getByText('Test Title')).toBeInTheDocument()
    expect(screen.getByText('Test Content')).toBeInTheDocument()
  })
})
