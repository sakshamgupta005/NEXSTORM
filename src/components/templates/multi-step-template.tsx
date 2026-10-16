'use client'

import React from 'react'
import { PageHeader, BreadcrumbItem } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Check, ChevronRight, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

export interface WorkflowStep {
  id: string
  title: string
  description?: string
}

export interface MultiStepWorkflowTemplateProps {
  title: React.ReactNode
  description?: React.ReactNode
  breadcrumbs?: BreadcrumbItem[]
  steps: WorkflowStep[]
  currentStepIndex: number
  canProceed?: boolean
  isSubmitting?: boolean
  onNext?: () => void
  onBack?: () => void
  onFinish?: () => void
  onStepClick?: (index: number) => void
  finishLabel?: string
  backLabel?: string
  nextLabel?: string
  error?: string | null
  children: React.ReactNode
  className?: string
}

export function MultiStepWorkflowTemplate({
  title,
  description,
  breadcrumbs,
  steps,
  currentStepIndex,
  canProceed = true,
  isSubmitting = false,
  onNext,
  onBack,
  onFinish,
  onStepClick,
  finishLabel = 'Complete',
  backLabel = 'Back',
  nextLabel = 'Continue',
  error = null,
  children,
  className = '',
}: MultiStepWorkflowTemplateProps) {
  const isFirstStep = currentStepIndex === 0
  const isLastStep = currentStepIndex === steps.length - 1
  const currentStep = steps[currentStepIndex]

  return (
    <div className={`space-y-6 max-w-4xl mx-auto ${className}`}>
      {/* Header */}
      <PageHeader
        title={title}
        description={description}
        breadcrumbs={breadcrumbs}
      />

      {/* Stepper Progress Indicator */}
      <nav aria-label="Workflow progress" className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <ol className="flex items-center justify-between w-full">
          {steps.map((step, idx) => {
            const isCompleted = idx < currentStepIndex
            const isCurrent = idx === currentStepIndex
            const isClickable = onStepClick && idx <= currentStepIndex

            return (
              <li
                key={step.id}
                className={`flex-1 flex items-center ${idx !== steps.length - 1 ? 'pr-2' : ''}`}
              >
                <button
                  type="button"
                  disabled={!isClickable}
                  onClick={() => onStepClick && isClickable && onStepClick(idx)}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={`flex items-center gap-3 text-left w-full focus:outline-none ${
                    !isClickable ? 'cursor-default' : 'cursor-pointer hover:opacity-80'
                  }`}
                >
                  {/* Step circle indicator */}
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                      isCompleted
                        ? 'bg-emerald-600 text-white'
                        : isCurrent
                        ? 'bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-950'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    }`}
                  >
                    {isCompleted ? <Check className="h-4 w-4" /> : idx + 1}
                  </div>

                  {/* Step text */}
                  <div className="hidden sm:block min-w-0">
                    <p
                      className={`text-xs font-semibold truncate ${
                        isCurrent
                          ? 'text-blue-600 dark:text-blue-400'
                          : isCompleted
                          ? 'text-slate-900 dark:text-slate-100'
                          : 'text-slate-400'
                      }`}
                    >
                      {step.title}
                    </p>
                    {step.description && (
                      <p className="text-[11px] text-slate-400 truncate">
                        {step.description}
                      </p>
                    )}
                  </div>
                </button>

                {/* Connecting line */}
                {idx !== steps.length - 1 && (
                  <div
                    className={`hidden sm:block flex-1 h-0.5 mx-3 transition-colors ${
                      idx < currentStepIndex
                        ? 'bg-emerald-500'
                        : 'bg-slate-200 dark:bg-slate-800'
                    }`}
                  />
                )}
              </li>
            )
          })}
        </ol>
      </nav>

      {/* Error message */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Main Step Content Card */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
        <CardContent className="p-6 sm:p-8 space-y-6">
          {currentStep && (
            <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {currentStep.title}
              </h2>
              {currentStep.description && (
                <p className="text-xs text-slate-500 mt-1">
                  {currentStep.description}
                </p>
              )}
            </div>
          )}

          {/* Step body */}
          <div className="min-h-[160px]">{children}</div>

          {/* Stepper Navigation Footer */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={onBack}
              disabled={isFirstStep || isSubmitting}
            >
              {backLabel}
            </Button>

            <div>
              {isLastStep ? (
                <Button
                  type="button"
                  onClick={onFinish}
                  isLoading={isSubmitting}
                  disabled={!canProceed || isSubmitting}
                >
                  {finishLabel}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={onNext}
                  disabled={!canProceed}
                >
                  <span>{nextLabel}</span>
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
