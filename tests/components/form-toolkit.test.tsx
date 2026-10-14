import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MultiStepFormStepper } from '@/components/forms/multi-step-form-stepper'
import { FormFieldWrapper } from '@/components/forms/form-field-wrapper'
import { FormDemo } from '@/components/forms/form-demo'

describe('Forms & Validation Toolkit - Component Tests', () => {
  describe('MultiStepFormStepper', () => {
    const mockSteps = [
      { id: 'step-1', title: 'Account' },
      { id: 'step-2', title: 'Profile' },
      { id: 'step-3', title: 'Review' },
    ]

    it('renders steps with active step highlighted via aria-current="step"', () => {
      render(
        <MultiStepFormStepper
          steps={mockSteps}
          currentStepIndex={1}
        />
      )

      expect(screen.getByText('Account')).toBeInTheDocument()
      expect(screen.getByText('Profile')).toBeInTheDocument()
      expect(screen.getByText('Review')).toBeInTheDocument()

      const stepItems = screen.getAllByRole('listitem')
      expect(stepItems[0]).not.toHaveAttribute('aria-current', 'step')
      expect(stepItems[1]).toHaveAttribute('aria-current', 'step')
      expect(stepItems[2]).not.toHaveAttribute('aria-current', 'step')
    })

    it('allows clicking on previous completed steps', () => {
      const handleStepClick = vi.fn()
      render(
        <MultiStepFormStepper
          steps={mockSteps}
          currentStepIndex={2}
          onStepClick={handleStepClick}
        />
      )

      const buttons = screen.getAllByRole('button')
      fireEvent.click(buttons[0]) // click step 1
      expect(handleStepClick).toHaveBeenCalledWith(0)
    })
  })

  describe('FormFieldWrapper', () => {
    it('renders label with required indicator and description', () => {
      render(
        <FormFieldWrapper
          id="email-field"
          label="Email Address"
          required
          description="Enter your primary email address."
        >
          <input id="email-field" type="email" />
        </FormFieldWrapper>
      )

      expect(screen.getByText('Email Address')).toBeInTheDocument()
      expect(screen.getByText('*')).toBeInTheDocument()
      expect(screen.getByText('Enter your primary email address.')).toBeInTheDocument()
    })

    it('renders error message with role="alert" when error is provided', () => {
      render(
        <FormFieldWrapper
          id="email-field"
          label="Email Address"
          error="Email is required"
        >
          <input id="email-field" type="email" />
        </FormFieldWrapper>
      )

      const alert = screen.getByRole('alert')
      expect(alert).toHaveTextContent('Email is required')
      expect(alert).toHaveAttribute('id', 'email-field-error')
    })
  })

  describe('FormDemo Interactive Flow', () => {
    it('blocks navigation to step 2 when step 1 validation fails', async () => {
      render(<FormDemo />)

      expect(screen.getByRole('heading', { name: 'Project Info' })).toBeInTheDocument()

      const continueBtn = screen.getByRole('button', { name: /Continue/i })
      fireEvent.click(continueBtn)

      // Should remain on Step 1 because title, category, description are required
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Project Info' })).toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: 'Team Roster' })).toBeNull()
      })
    })

    it('allows completing step 1 with valid inputs and advancing to step 2', async () => {
      render(<FormDemo />)

      const titleInput = screen.getByPlaceholderText('e.g. EcoTracker Mobile')
      fireEvent.change(titleInput, { target: { value: 'EcoTracker Hackathon' } })

      const categorySelect = screen.getByRole('combobox')
      fireEvent.change(categorySelect, { target: { value: 'climate' } })

      const descTextarea = screen.getByPlaceholderText('Describe what the product accomplishes...')
      fireEvent.change(descTextarea, {
        target: { value: 'Tracking carbon emissions across distributed cloud clusters.' },
      })

      const continueBtn = screen.getByRole('button', { name: /Continue/i })
      fireEvent.click(continueBtn)

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Team Roster' })).toBeInTheDocument()
      })
    })

    it('supports dynamic field array operations (add and remove team members)', async () => {
      render(<FormDemo />)

      // Advance to Step 2
      fireEvent.change(screen.getByPlaceholderText('e.g. EcoTracker Mobile'), {
        target: { value: 'EcoTracker Hackathon' },
      })
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'climate' } })
      fireEvent.change(
        screen.getByPlaceholderText('Describe what the product accomplishes...'),
        { target: { value: 'Tracking carbon emissions across distributed cloud clusters.' } }
      )
      fireEvent.click(screen.getByRole('button', { name: /Continue/i }))

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Team Roster' })).toBeInTheDocument()
      })

      // Check default team member
      expect(screen.getByDisplayValue('Alex Rivera')).toBeInTheDocument()

      // Add a member
      const addMemberBtn = screen.getByRole('button', { name: /\+ Add Member/i })
      fireEvent.click(addMemberBtn)

      const memberInputs = screen.getAllByPlaceholderText('Member Name')
      expect(memberInputs).toHaveLength(2)

      // Remove the added member
      const removeBtns = screen.getAllByRole('button', { name: /Remove/i })
      fireEvent.click(removeBtns[1])

      expect(screen.getAllByPlaceholderText('Member Name')).toHaveLength(1)
    })
  })
})
