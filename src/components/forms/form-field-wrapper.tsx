'use client'

import React from 'react'
import { Label } from '@/components/ui/label'

interface FormFieldWrapperProps {
  id?: string
  label: string
  description?: string
  error?: string
  required?: boolean
  children: React.ReactNode
  className?: string
}

export function FormFieldWrapper({
  id,
  label,
  description,
  error,
  required = false,
  children,
  className = '',
}: FormFieldWrapperProps) {
  const descId = id && description ? `${id}-description` : undefined
  const errorId = id && error ? `${id}-error` : undefined

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="text-xs font-semibold text-foreground">
          {label}
          {required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
        </Label>
      </div>

      {description && (
        <p id={descId} className="text-xs text-muted-foreground">
          {description}
        </p>
      )}

      {children}

      {error && (
        <p
          id={errorId}
          role="alert"
          aria-live="assertive"
          className="text-xs font-medium text-red-600 dark:text-red-400 mt-1"
        >
          {error}
        </p>
      )}
    </div>
  )
}
