'use client'

import React from 'react'
import type { StepConfig } from '@/lib/forms/types'

interface MultiStepFormStepperProps<T = Record<string, unknown>> {
  steps: StepConfig<T>[]
  currentStepIndex: number
  onStepClick?: (stepIndex: number) => void
  className?: string
}

export function MultiStepFormStepper<T = Record<string, unknown>>({
  steps,
  currentStepIndex,
  onStepClick,
  className = '',
}: MultiStepFormStepperProps<T>) {
  const progressPercentage = Math.round(((currentStepIndex + 1) / steps.length) * 100)

  return (
    <nav aria-label="Form Progress" className={`w-full space-y-4 ${className}`}>
      {/* Visual progress bar */}
      <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
        <div
          className="bg-blue-600 dark:bg-blue-500 h-full transition-all duration-300 ease-out"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>

      {/* Step items */}
      <ol className="flex items-center justify-between gap-2">
        {steps.map((step, idx) => {
          const isCurrent = idx === currentStepIndex
          const isCompleted = idx < currentStepIndex
          const isClickable = Boolean(onStepClick && idx <= currentStepIndex)

          return (
            <li
              key={step.id}
              className="flex-1 flex flex-col items-center text-center group cursor-default"
              aria-current={isCurrent ? 'step' : undefined}
            >
              <button
                type="button"
                onClick={() => isClickable && onStepClick?.(idx)}
                disabled={!isClickable}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                  isCurrent
                    ? 'bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-950/60'
                    : isCompleted
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`}
              >
                {isCompleted ? (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2.5"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  idx + 1
                )}
              </button>

              <span
                className={`text-xs mt-1.5 font-medium truncate max-w-[120px] ${
                  isCurrent
                    ? 'text-blue-600 dark:text-blue-400 font-semibold'
                    : isCompleted
                    ? 'text-slate-900 dark:text-slate-100'
                    : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {step.title}
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
