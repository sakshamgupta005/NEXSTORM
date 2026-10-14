'use client'

import { useState, useCallback, useMemo } from 'react'
import type { StepConfig } from './types'

export interface UseMultiStepFormOptions<T = Record<string, unknown>> {
  steps: StepConfig<T>[]
  initialStepIndex?: number
  onStepChange?: (newStepIndex: number, currentStep: StepConfig<T>) => void
}

export function useMultiStepForm<T = Record<string, unknown>>(
  options: UseMultiStepFormOptions<T>
) {
  const { steps, initialStepIndex = 0, onStepChange } = options
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(initialStepIndex)

  const totalSteps = steps.length
  const currentStep = steps[currentStepIndex] || steps[0]
  const isFirstStep = currentStepIndex === 0
  const isLastStep = currentStepIndex === totalSteps - 1

  const progressPercentage = useMemo(() => {
    if (totalSteps === 0) return 0
    return Math.round(((currentStepIndex + 1) / totalSteps) * 100)
  }, [currentStepIndex, totalSteps])

  const goToStep = useCallback(
    (index: number) => {
      if (index >= 0 && index < totalSteps) {
        setCurrentStepIndex(index)
        if (onStepChange) {
          onStepChange(index, steps[index])
        }
      }
    },
    [steps, totalSteps, onStepChange]
  )

  const nextStep = useCallback(
    async (validateStep?: () => Promise<boolean> | boolean): Promise<boolean> => {
      if (validateStep) {
        const isValid = await validateStep()
        if (!isValid) return false
      }

      if (!isLastStep) {
        const nextIdx = currentStepIndex + 1
        setCurrentStepIndex(nextIdx)
        if (onStepChange) {
          onStepChange(nextIdx, steps[nextIdx])
        }
        return true
      }
      return false
    },
    [currentStepIndex, isLastStep, onStepChange, steps]
  )

  const prevStep = useCallback(() => {
    if (!isFirstStep) {
      const prevIdx = currentStepIndex - 1
      setCurrentStepIndex(prevIdx)
      if (onStepChange) {
        onStepChange(prevIdx, steps[prevIdx])
      }
      return true
    }
    return false
  }, [currentStepIndex, isFirstStep, onStepChange, steps] )

  const resetSteps = useCallback(() => {
    setCurrentStepIndex(0)
    if (onStepChange) {
      onStepChange(0, steps[0])
    }
  }, [onStepChange, steps])

  return {
    steps,
    currentStepIndex,
    currentStep,
    totalSteps,
    isFirstStep,
    isLastStep,
    progressPercentage,
    goToStep,
    nextStep,
    prevStep,
    resetSteps,
  }
}
