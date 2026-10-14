'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import type {
  UseFormOptions,
  FormErrors,
  RegisteredFieldProps,
  RegisterOptions,
} from './types'
import { getNestedValue, setNestedValue, validateWithZod, mapServerErrors } from './resolver'

const SENSITIVE_KEY_PATTERNS = [
  'password',
  'token',
  'secret',
  'apikey',
  'api_key',
  'creditcard',
  'cvv',
  'auth',
]

function isSensitiveKey(key: string, excludedList: (string | number | symbol)[] = []): boolean {
  const lower = key.toLowerCase()
  if (excludedList.some((e) => String(e).toLowerCase() === lower)) {
    return true
  }
  return SENSITIVE_KEY_PATTERNS.some((pattern) => lower.includes(pattern))
}

function sanitizeDraftValues<T extends Record<string, unknown>>(
  values: T,
  excludedKeys: (keyof T | string)[] = []
): Partial<T> {
  const safe: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(values)) {
    if (!isSensitiveKey(key, excludedKeys)) {
      safe[key] = val
    }
  }
  return safe as Partial<T>
}

export function useForm<T extends Record<string, unknown>>(options: UseFormOptions<T>) {
  const [initialValues, setInitialValues] = useState<T>(() => ({ ...options.defaultValues }))
  const [values, setValues] = useState<T>(() => ({ ...options.defaultValues }))
  const [errors, setErrors] = useState<FormErrors<T>>({})
  const [touched, setTouched] = useState<Partial<Record<string, boolean>>>({})
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [submitCount, setSubmitCount] = useState<number>(0)
  const [isSubmitSuccessful, setIsSubmitSuccessful] = useState<boolean>(false)

  // Track dirty state
  const isDirty = useMemo(() => {
    return JSON.stringify(values) !== JSON.stringify(initialValues)
  }, [values, initialValues])

  // Draft persistence in browser storage (with automatic sensitive key scrubbing)
  useEffect(() => {
    if (!options.persistDraftKey || typeof window === 'undefined') return

    try {
      const sanitized = sanitizeDraftValues(values, options.excludeFromDraft)
      sessionStorage.setItem(options.persistDraftKey, JSON.stringify(sanitized))
    } catch {
      // storage unavailable / quota exceeded
    }
  }, [values, options.persistDraftKey, options.excludeFromDraft])

  const restoreDraft = useCallback((): boolean => {
    if (!options.persistDraftKey || typeof window === 'undefined') return false

    try {
      const stored = sessionStorage.getItem(options.persistDraftKey)
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<T>
        setValues((prev) => ({ ...prev, ...parsed }))
        return true
      }
    } catch {
      // parse error
    }
    return false
  }, [options.persistDraftKey])

  const clearDraft = useCallback(() => {
    if (!options.persistDraftKey || typeof window === 'undefined') return
    try {
      sessionStorage.removeItem(options.persistDraftKey)
    } catch {
      // ignore
    }
  }, [options.persistDraftKey])

  const setValue = useCallback((name: string, value: unknown) => {
    setValues((prev) => setNestedValue(prev, name, value))
    setTouched((prev) => ({ ...prev, [name]: true }))
  }, [])

  const setError = useCallback((name: string, message: string) => {
    setErrors((prev) => ({ ...prev, [name]: message }))
  }, [])

  const clearErrors = useCallback((name?: string) => {
    if (name) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[name]
        return next
      })
    } else {
      setErrors({})
    }
  }, [])

  const validateForm = useCallback(async (): Promise<{
    isValid: boolean
    errors: FormErrors<T>
    validatedValues?: T
  }> => {
    if (!options.schema) {
      return { isValid: true, errors: {}, validatedValues: values }
    }

    const { values: validatedValues, errors: schemaErrors } = await validateWithZod(
      options.schema,
      values
    )

    if (schemaErrors && Object.keys(schemaErrors).length > 0) {
      setErrors(schemaErrors)
      return { isValid: false, errors: schemaErrors }
    }

    setErrors({})
    return { isValid: true, errors: {}, validatedValues }
  }, [options.schema, values])

  const register = useCallback(
    (name: string, fieldOpts?: RegisterOptions): RegisteredFieldProps => {
      const val = getNestedValue(values, name)
      const fieldError = errors[name]
      const errorId = fieldError ? `${name}-error` : undefined

      return {
        name,
        value: (val !== undefined && val !== null ? (typeof val === 'string' || typeof val === 'number' ? val : String(val)) : '') as string | number | undefined,
        onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
          let newValue: unknown
          if (e && typeof e === 'object' && 'target' in e) {
            const target = e.target as HTMLInputElement
            if (target.type === 'checkbox') {
              newValue = target.checked
            } else {
              newValue = target.value
            }
          } else {
            newValue = e
          }

          setValue(name, newValue)
          if (fieldOpts?.onChange) {
            fieldOpts.onChange(e)
          }

          if (options.mode === 'onChange' && options.schema) {
            validateWithZod(options.schema, setNestedValue(values, name, newValue)).then((res) => {
              if (res.errors) setErrors(res.errors)
              else clearErrors(name)
            })
          }
        },
        onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
          setTouched((prev) => ({ ...prev, [name]: true }))
          if (fieldOpts?.onBlur) {
            fieldOpts.onBlur(e)
          }

          if (options.mode === 'onBlur' && options.schema) {
            validateWithZod(options.schema, values).then((res) => {
              if (res.errors) setErrors(res.errors)
              else clearErrors(name)
            })
          }
        },
        'aria-invalid': fieldError ? 'true' : undefined,
        'aria-describedby': errorId,
      }
    },
    [values, errors, setValue, clearErrors, options.mode, options.schema]
  )

  const handleSubmit = useCallback(
    (
      onValid: (data: T) => Promise<void> | void,
      onInvalid?: (errors: FormErrors<T>) => void
    ) => {
      return async (e?: React.FormEvent) => {
        if (e && typeof e.preventDefault === 'function') {
          e.preventDefault()
        }

        // Prevent double submission
        if (isSubmitting) {
          return
        }

        setIsSubmitting(true)
        setSubmitCount((c) => c + 1)
        setIsSubmitSuccessful(false)

        try {
          const { isValid, errors: validationErrors, validatedValues } = await validateForm()

          if (!isValid) {
            if (onInvalid) onInvalid(validationErrors)
            return
          }

          await onValid((validatedValues || values) as T)
          setIsSubmitSuccessful(true)
          clearDraft()
        } catch (err) {
          // Normalize server errors
          const mapped = mapServerErrors<T>(err)
          setErrors(mapped)
          if (onInvalid) onInvalid(mapped)
        } finally {
          setIsSubmitting(false)
        }
      }
    },
    [isSubmitting, validateForm, values, clearDraft]
  )

  const reset = useCallback((newValues?: T) => {
    const nextVals = newValues ? { ...newValues } : { ...initialValues }
    setValues(nextVals)
    if (newValues) {
      setInitialValues({ ...newValues })
    }
    setErrors({})
    setTouched({})
    setIsSubmitting(false)
    setIsSubmitSuccessful(false)
  }, [initialValues])

  return {
    values,
    errors,
    touched,
    isDirty,
    isSubmitting,
    submitCount,
    isSubmitSuccessful,
    register,
    setValue,
    setError,
    clearErrors,
    validateForm,
    handleSubmit,
    reset,
    restoreDraft,
    clearDraft,
  }
}
