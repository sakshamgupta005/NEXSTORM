/**
 * Type definitions for Reusable Forms & Validation Toolkit.
 */

import type { ZodType } from 'zod'

export type FormErrors<T = Record<string, unknown>> = Record<string, string | undefined> & {
  _form?: string
  _type?: T
}

export interface FieldState {
  isTouched: boolean
  isDirty: boolean
  error?: string
  isValid: boolean
}

export interface FormState<T = Record<string, unknown>> {
  values: T
  errors: FormErrors<T>
  touched: Partial<Record<keyof T | string, boolean>>
  isDirty: boolean
  isSubmitting: boolean
  isValid: boolean
  submitCount: number
  isSubmitSuccessful: boolean
}

export type ValidationMode = 'onSubmit' | 'onChange' | 'onBlur'

export interface UseFormOptions<T = Record<string, unknown>> {
  defaultValues: T
  schema?: ZodType<T>
  mode?: ValidationMode
  persistDraftKey?: string
  excludeFromDraft?: (keyof T | string)[]
}

export interface RegisterOptions {
  required?: boolean | string
  onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void
  onBlur?: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void
}

export interface RegisteredFieldProps {
  name: string
  value: string | number | readonly string[] | undefined
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void
  onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void
  'aria-invalid'?: 'true'
  'aria-describedby'?: string
}

export interface StepConfig<T = Record<string, unknown>> {
  id: string
  title: string
  description?: string
  fields?: (keyof T | string)[]
}

export interface MultiStepFormState<T = Record<string, unknown>> {
  currentStepIndex: number
  totalSteps: number
  currentStep: StepConfig<T>
  isFirstStep: boolean
  isLastStep: boolean
  progressPercentage: number
}

export interface FileValidationOptions {
  maxSizeBytes?: number
  allowedExtensions?: string[]
  allowedMimeTypes?: string[]
  verifyMagicBytes?: boolean
}

export interface FileValidationResult {
  isValid: boolean
  error?: string
  detectedType?: string
}
