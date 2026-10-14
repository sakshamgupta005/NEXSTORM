'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Label } from './label'

// --- Textarea ---

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, id, ...props }, ref) => {
    const errorId = id && error ? `${id}-error` : undefined

    return (
      <div className="w-full">
        <textarea
          id={id}
          ref={ref}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={errorId}
          className={cn(
            'flex min-h-[80px] w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-colors shadow-sm',
            error && 'border-red-500 focus-visible:ring-red-500',
            className
          )}
          {...props}
        />
        {error && (
          <p id={errorId} role="alert" className="mt-1.5 text-xs text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    )
  }
)
Textarea.displayName = 'Textarea'

// --- Select ---

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[]
  placeholder?: string
  error?: string
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, options, placeholder, error, id, ...props }, ref) => {
    const errorId = id && error ? `${id}-error` : undefined

    return (
      <div className="w-full">
        <select
          id={id}
          ref={ref}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={errorId}
          className={cn(
            'flex h-10 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-colors shadow-sm cursor-pointer',
            error && 'border-red-500 focus-visible:ring-red-500',
            className
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && (
          <p id={errorId} role="alert" className="mt-1.5 text-xs text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    )
  }
)
Select.displayName = 'Select'

// --- Checkbox ---

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode
  description?: string
  error?: string
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, description, error, id, ...props }, ref) => {
    const generatedId = React.useId()
    const inputId = id || generatedId
    const errorId = error ? `${inputId}-error` : undefined

    return (
      <div className="flex flex-col">
        <div className="flex items-start space-x-2.5">
          <input
            id={inputId}
            type="checkbox"
            ref={ref}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={errorId}
            className={cn(
              'h-4 w-4 mt-0.5 rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400 dark:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer',
              error && 'border-red-500 focus:ring-red-500',
              className
            )}
            {...props}
          />
          {label && (
            <div className="text-sm">
              <label
                htmlFor={inputId}
                className="font-medium text-slate-900 dark:text-slate-100 cursor-pointer select-none"
              >
                {label}
              </label>
              {description && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {description}
                </p>
              )}
            </div>
          )}
        </div>
        {error && (
          <p id={errorId} role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    )
  }
)
Checkbox.displayName = 'Checkbox'

// --- Radio & RadioGroup ---

export interface RadioOption {
  value: string
  label: React.ReactNode
  description?: string
  disabled?: boolean
}

export interface RadioGroupProps {
  name: string
  options: RadioOption[]
  value?: string
  defaultValue?: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  label?: string
  error?: string
  className?: string
  disabled?: boolean
}

export function RadioGroup({
  name,
  options,
  value,
  defaultValue,
  onChange,
  label,
  error,
  className,
  disabled,
}: RadioGroupProps) {
  const errorId = error ? `${name}-error` : undefined

  return (
    <fieldset className={cn('space-y-2', className)} aria-invalid={error ? 'true' : undefined}>
      {label && (
        <legend className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">
          {label}
        </legend>
      )}
      <div className="space-y-2">
        {options.map((opt) => {
          const optId = `${name}-${opt.value}`
          return (
            <div key={opt.value} className="flex items-start space-x-2.5">
              <input
                id={optId}
                name={name}
                type="radio"
                value={opt.value}
                checked={value !== undefined ? value === opt.value : undefined}
                defaultChecked={defaultValue !== undefined ? defaultValue === opt.value : undefined}
                onChange={onChange}
                disabled={disabled || opt.disabled}
                className="h-4 w-4 mt-0.5 border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              />
              <div className="text-sm">
                <label
                  htmlFor={optId}
                  className="font-medium text-slate-900 dark:text-slate-100 cursor-pointer select-none"
                >
                  {opt.label}
                </label>
                {opt.description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {opt.description}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </fieldset>
  )
}

// --- Switch (Accessible Toggle) ---

export interface SwitchProps {
  id?: string
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  label?: React.ReactNode
  description?: string
  className?: string
  error?: string
}

export function Switch({
  id,
  checked: controlledChecked,
  defaultChecked = false,
  onCheckedChange,
  disabled = false,
  label,
  description,
  className,
  error,
}: SwitchProps) {
  const generatedId = React.useId()
  const switchId = id || generatedId
  const [uncontrolledChecked, setUncontrolledChecked] = React.useState(defaultChecked)
  const isChecked = controlledChecked !== undefined ? controlledChecked : uncontrolledChecked

  const handleToggle = () => {
    if (disabled) return
    const next = !isChecked
    if (controlledChecked === undefined) {
      setUncontrolledChecked(next)
    }
    onCheckedChange?.(next)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      handleToggle()
    }
  }

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="flex items-center space-x-3">
        <button
          id={switchId}
          type="button"
          role="switch"
          aria-checked={isChecked}
          aria-label={typeof label === 'string' ? label : undefined}
          disabled={disabled}
          onClick={handleToggle}
          onKeyDown={handleKeyDown}
          className={cn(
            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none',
            isChecked ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
          )}
        >
          <span
            className={cn(
              'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out motion-reduce:transition-none',
              isChecked ? 'translate-x-5' : 'translate-x-0'
            )}
          />
        </button>
        {label && (
          <div className="text-sm">
            <label
              htmlFor={switchId}
              onClick={handleToggle}
              className="font-medium text-slate-900 dark:text-slate-100 cursor-pointer select-none"
            >
              {label}
            </label>
            {description && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {description}
              </p>
            )}
          </div>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}

// --- FormField Wrapper ---

export interface FormFieldProps {
  id: string
  label?: string
  description?: string
  error?: string
  required?: boolean
  children: React.ReactNode
  className?: string
}

export function FormField({
  id,
  label,
  description,
  error,
  required,
  children,
  className,
}: FormFieldProps) {
  const errorId = error ? `${id}-error` : undefined
  const descriptionId = description ? `${id}-description` : undefined

  return (
    <div className={cn('space-y-1.5 w-full', className)}>
      {label && (
        <Label htmlFor={id} className="flex items-center space-x-1">
          <span>{label}</span>
          {required && <span className="text-red-500" aria-hidden="true">*</span>}
        </Label>
      )}
      {description && (
        <p id={descriptionId} className="text-xs text-slate-500 dark:text-slate-400">
          {description}
        </p>
      )}
      {children}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-red-600 dark:text-red-400 mt-1">
          {error}
        </p>
      )}
    </div>
  )
}
