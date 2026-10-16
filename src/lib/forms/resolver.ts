/**
 * Schema validation resolver and server-side error mapping utilities.
 */

import type { ZodType, ZodIssue } from 'zod'
import type { FormErrors } from './types'

/**
 * Accesses a deep nested value within an object via dotted path (e.g. 'users.0.name').
 */
export function getNestedValue(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== 'object') return undefined
  const parts = path.split('.')
  let current: unknown = obj

  for (const part of parts) {
    if (current === null || current === undefined) return undefined
    if (typeof current === 'object' && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part]
    } else {
      return undefined
    }
  }

  return current
}

/**
 * Immutably sets a deep nested value within an object via dotted path.
 */
export function setNestedValue<T>(obj: T, path: string, value: unknown): T {
  const parts = path.split('.')
  if (parts.length === 0) return obj

  const clone = Array.isArray(obj) ? ([...obj] as unknown as T) : ({ ...obj } as T)
  let current: Record<string, unknown> = clone as unknown as Record<string, unknown>

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]
    const nextPart = parts[i + 1]
    const isNextNumber = !isNaN(Number(nextPart))

    if (!current[part] || typeof current[part] !== 'object') {
      current[part] = isNextNumber ? [] : {}
    } else {
      current[part] = Array.isArray(current[part])
        ? [...current[part]]
        : { ...(current[part] as Record<string, unknown>) }
    }
    current = current[part] as Record<string, unknown>
  }

  const lastPart = parts[parts.length - 1]
  current[lastPart] = value
  return clone
}

/**
 * Validates form values against a Zod schema, returning parsed values or path-mapped errors.
 */
export async function validateWithZod<T>(
  schema: ZodType<T>,
  values: unknown
): Promise<{ values?: T; errors?: FormErrors<T> }> {
  const result = await schema.safeParseAsync(values)

  if (result.success) {
    return { values: result.data }
  }

  const errors: FormErrors<T> = {}
  for (const issue of result.error.issues as ZodIssue[]) {
    const fieldPath = issue.path.length > 0 ? issue.path.join('.') : '_form'
    // Do not overwrite earlier error on the same path if already set
    if (!errors[fieldPath]) {
      errors[fieldPath] = issue.message
    }
  }

  return { errors }
}

/**
 * Normalizes backend error responses (e.g. from Supabase, REST APIs, or Server Actions) into FormErrors.
 */
export function mapServerErrors<T = Record<string, unknown>>(error: unknown): FormErrors<T> {
  const errors: FormErrors<T> = {}

  if (!error) return errors

  if (typeof error === 'string') {
    errors._form = error
    return errors
  }

  if (typeof error === 'object' && error !== null) {
    const errObj = error as Record<string, unknown>

    // 1. Check for nested error details / field maps: { details: { email: 'Already taken' } }
    if (errObj.details && typeof errObj.details === 'object' && !Array.isArray(errObj.details)) {
      for (const [key, val] of Object.entries(errObj.details)) {
        if (typeof val === 'string') errors[key] = val
      }
      return errors
    }

    // 2. Check for validation array: { errors: [{ field: 'email', message: 'Invalid' }] }
    if (Array.isArray(errObj.errors)) {
      for (const item of errObj.errors) {
        if (item && typeof item === 'object') {
          const field = (item.field || item.path || '_form') as string
          const msg = (item.message || item.error || 'Invalid value') as string
          if (!errors[field]) errors[field] = msg
        }
      }
      return errors
    }

    // 3. Check for standard error message: { message: '...' }
    if (typeof errObj.message === 'string') {
      errors._form = errObj.message
      return errors
    }

    // 4. Check for top-level error property: { error: '...' }
    if (typeof errObj.error === 'string') {
      errors._form = errObj.error
      return errors
    }
  }

  errors._form = 'An unexpected error occurred. Please check your submission and try again.'
  return errors
}
