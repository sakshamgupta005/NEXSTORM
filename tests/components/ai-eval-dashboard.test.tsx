import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EvalDashboard } from '@/components/ai-eval/eval-dashboard'

describe('AI Evaluation Dashboard Component Tests', () => {
  beforeEach(() => {
    // Mock navigator.clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
  })

  it('renders dashboard with header, benchmark dataset badge, and controls', async () => {
    render(<EvalDashboard />)

    expect(
      screen.getByText('AI Evaluation & Benchmarking Toolkit')
    ).toBeInTheDocument()
    expect(screen.getByText(/Dataset v1\.0\.0/)).toBeInTheDocument()

    // Wait for the initial auto-run to complete
    await waitFor(() => {
      expect(screen.getByText('Pass Rate')).toBeInTheDocument()
      expect(screen.getByText('Average Score')).toBeInTheDocument()
    }, { timeout: 5000 })
  })

  it('displays metric cards and test case list after benchmark run', async () => {
    render(<EvalDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Evaluation Test Cases (7 / 7)')).toBeInTheDocument()
      expect(screen.getByText('Customer Support Sentiment Classification')).toBeInTheDocument()
    }, { timeout: 5000 })

    // Expand a test case row to check details
    const caseTitle = screen.getByText('Customer Support Sentiment Classification')
    fireEvent.click(caseTitle)

    await waitFor(() => {
      expect(screen.getByText('Model Output:')).toBeInTheDocument()
      expect(screen.getByText('Evaluator Breakdown:')).toBeInTheDocument()
    }, { timeout: 5000 })
  })

  it('filters test cases by search query and category', async () => {
    render(<EvalDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Evaluation Test Cases (7 / 7)')).toBeInTheDocument()
    }, { timeout: 5000 })

    const searchInput = screen.getByPlaceholderText('Search test cases...')
    fireEvent.change(searchInput, { target: { value: 'Sentiment' } })

    expect(screen.getByText('Evaluation Test Cases (1 / 7)')).toBeInTheDocument()
    expect(screen.getByText('Customer Support Sentiment Classification')).toBeInTheDocument()
    expect(screen.queryByText('Weather API Tool Invocation')).not.toBeInTheDocument()
  })

  it('detects and flags regressions when running the regression scenario', async () => {
    render(<EvalDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Evaluation Test Cases (7 / 7)')).toBeInTheDocument()
    }, { timeout: 5000 })

    // Select regression scenario
    const select = screen.getByLabelText('Simulation Scenario')
    fireEvent.change(select, { target: { value: 'regression' } })

    // Click Run Benchmark
    const runButton = screen.getByRole('button', { name: /Run Benchmark/i })
    fireEvent.click(runButton)

    // Wait for evaluation run and check regression banner
    await waitFor(() => {
      expect(screen.getByText(/AI Regression Detected against Baseline/)).toBeInTheDocument()
    }, { timeout: 5000 })

    expect(screen.getByText(/Pass rate dropped/)).toBeInTheDocument()
  })

  it('copies Markdown and JSON reports to clipboard', async () => {
    render(<EvalDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Evaluation Test Cases (7 / 7)')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Copy Markdown/i })).toBeEnabled()
    }, { timeout: 5000 })

    const copyMdBtn = screen.getByRole('button', { name: /Copy Markdown/i })
    fireEvent.click(copyMdBtn)

    await waitFor(() => {
      expect(screen.getByText('Markdown copied to clipboard!')).toBeInTheDocument()
    })
    expect(navigator.clipboard.writeText).toHaveBeenCalled()
  })
})
