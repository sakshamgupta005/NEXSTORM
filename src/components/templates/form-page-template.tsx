'use client'

import React from 'react'
import { PageHeader, BreadcrumbItem } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { UnsavedChangesBanner } from '@/components/ui/state-views'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

export interface FormPageTemplateProps {
  title: React.ReactNode
  description?: React.ReactNode
  breadcrumbs?: BreadcrumbItem[]
  backHref?: string
  backLabel?: string
  isSubmitting?: boolean
  submitLabel?: string
  cancelLabel?: string
  onCancel?: () => void
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void
  error?: string | null
  successMessage?: string | null
  hasUnsavedChanges?: boolean
  onDiscardChanges?: () => void
  actions?: React.ReactNode
  maxWidth?: 'xl' | '2xl' | '3xl' | '4xl' | 'full'
  children: React.ReactNode
  className?: string
}

export function FormPageTemplate({
  title,
  description,
  breadcrumbs,
  backHref,
  backLabel,
  isSubmitting = false,
  submitLabel = 'Save changes',
  cancelLabel = 'Cancel',
  onCancel,
  onSubmit,
  error = null,
  successMessage = null,
  hasUnsavedChanges = false,
  onDiscardChanges,
  actions,
  maxWidth = '3xl',
  children,
  className = '',
}: FormPageTemplateProps) {
  const maxWidthClass = {
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    full: 'max-w-full',
  }[maxWidth]

  const formContent = (
    <div className="space-y-6">
      {/* Status Alerts */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Submission Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {successMessage && (
        <Alert className="border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      {/* Main Form Fields Card */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
        <CardContent className="p-6 sm:p-8 space-y-6">
          {children}

          {/* Form Actions Footer */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3 flex-wrap">
            {actions}
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isSubmitting}
              >
                {cancelLabel}
              </Button>
            )}
            <Button
              type="submit"
              isLoading={isSubmitting}
              disabled={isSubmitting}
            >
              {submitLabel}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )

  return (
    <div className={`space-y-6 ${maxWidthClass} ${className}`}>
      {/* Header */}
      <PageHeader
        title={title}
        description={description}
        breadcrumbs={breadcrumbs}
        backHref={backHref}
        backLabel={backLabel}
      />

      {/* Unsaved Changes Banner */}
      <UnsavedChangesBanner
        hasChanges={hasUnsavedChanges}
        onDiscard={onDiscardChanges}
        isSaving={isSubmitting}
      />

      {/* Form Wrapper */}
      {onSubmit ? (
        <form onSubmit={onSubmit} noValidate>
          {formContent}
        </form>
      ) : (
        formContent
      )}
    </div>
  )
}
