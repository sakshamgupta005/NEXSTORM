'use client'

import React from 'react'
import { AlertCircle, CheckCircle2, Loader2, Inbox, ShieldAlert, FileQuestion, AlertTriangle } from 'lucide-react'
import { Button } from './button'
import { Skeleton } from './skeleton'

export interface StateViewProps {
  title?: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  className?: string
}

export function LoadingState({
  title = 'Loading...',
  description,
  className = '',
}: {
  title?: string
  description?: string
  className?: string
}) {
  return (
    <div
      data-testid="loading-state"
      className={`flex flex-col items-center justify-center p-8 text-center rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 ${className}`}
    >
      <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400 mb-3" />
      <p className="font-medium text-slate-900 dark:text-slate-100">{title}</p>
      {description && <p className="text-xs text-slate-500 mt-1 max-w-sm">{description}</p>}
    </div>
  )
}

export function EmptyState({
  title = 'No items found',
  description = 'Get started by creating your first entry.',
  actionLabel,
  onAction,
  className = '',
}: StateViewProps) {
  return (
    <div
      data-testid="empty-state"
      className={`flex flex-col items-center justify-center p-8 text-center rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-900/30 ${className}`}
    >
      <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
        <Inbox className="h-5 w-5 text-slate-500" />
      </div>
      <h3 className="font-medium text-slate-900 dark:text-slate-100">{title}</h3>
      {description && <p className="text-xs text-slate-500 mt-1 max-w-sm">{description}</p>}
      {actionLabel && onAction && (
        <Button size="sm" onClick={onAction} className="mt-4">
          {actionLabel}
        </Button>
      )}
    </div>
  )
}

export function ErrorState({
  title = 'An error occurred',
  description = 'Something went wrong while processing your request.',
  actionLabel = 'Try again',
  onAction,
  className = '',
}: StateViewProps) {
  return (
    <div
      data-testid="error-state"
      className={`flex flex-col items-center justify-center p-8 text-center rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50/30 dark:bg-red-950/20 ${className}`}
    >
      <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center mb-3">
        <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
      </div>
      <h3 className="font-medium text-red-900 dark:text-red-200">{title}</h3>
      {description && <p className="text-xs text-red-600 dark:text-red-400 mt-1 max-w-sm">{description}</p>}
      {actionLabel && onAction && (
        <Button variant="outline" size="sm" onClick={onAction} className="mt-4 border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300">
          {actionLabel}
        </Button>
      )}
    </div>
  )
}

export function SuccessState({
  title = 'Operation completed',
  description,
  actionLabel,
  onAction,
  className = '',
}: StateViewProps) {
  return (
    <div
      data-testid="success-state"
      className={`flex flex-col items-center justify-center p-8 text-center rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-950/20 ${className}`}
    >
      <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mb-3">
        <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
      </div>
      <h3 className="font-medium text-emerald-900 dark:text-emerald-200">{title}</h3>
      {description && <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 max-w-sm">{description}</p>}
      {actionLabel && onAction && (
        <Button size="sm" onClick={onAction} className="mt-4">
          {actionLabel}
        </Button>
      )}
    </div>
  )
}

export function PermissionDeniedState({
  title = 'Access Denied',
  description = 'You do not have the required permissions to view this resource.',
  actionLabel = 'Go back',
  onAction,
  className = '',
}: StateViewProps) {
  return (
    <div
      data-testid="permission-denied-state"
      className={`flex flex-col items-center justify-center p-8 text-center rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-950/20 ${className}`}
    >
      <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center mb-3">
        <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400" />
      </div>
      <h3 className="font-medium text-amber-900 dark:text-amber-200">{title}</h3>
      {description && <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 max-w-sm">{description}</p>}
      {actionLabel && onAction && (
        <Button variant="outline" size="sm" onClick={onAction} className="mt-4 border-amber-300 text-amber-800 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300">
          {actionLabel}
        </Button>
      )}
    </div>
  )
}

export function NotFoundState({
  title = 'Page or Item Not Found',
  description = 'The resource you requested does not exist or has been moved.',
  actionLabel = 'Return to Overview',
  onAction,
  className = '',
}: StateViewProps) {
  return (
    <div
      data-testid="not-found-state"
      className={`flex flex-col items-center justify-center p-8 text-center rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 ${className}`}
    >
      <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
        <FileQuestion className="h-5 w-5 text-slate-500 dark:text-slate-400" />
      </div>
      <h3 className="font-medium text-slate-900 dark:text-slate-100">{title}</h3>
      {description && <p className="text-xs text-slate-500 mt-1 max-w-sm">{description}</p>}
      {actionLabel && onAction && (
        <Button size="sm" onClick={onAction} className="mt-4">
          {actionLabel}
        </Button>
      )}
    </div>
  )
}

export function PageSkeletonState({
  cardsCount = 3,
  className = '',
}: {
  cardsCount?: number
  className?: string
}) {
  return (
    <div data-testid="page-skeleton-state" className={`space-y-6 ${className}`}>
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>

      {/* Grid of Skeleton Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: cardsCount }).map((_, idx) => (
          <div
            key={idx}
            className="p-5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-12" />
            </div>
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-3 w-40" />
          </div>
        ))}
      </div>

      {/* Content Area Skeleton */}
      <div className="p-6 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>
    </div>
  )
}

export function UnsavedChangesBanner({
  hasChanges,
  onDiscard,
  onSave,
  isSaving = false,
  className = '',
}: {
  hasChanges: boolean
  onDiscard?: () => void
  onSave?: () => void
  isSaving?: boolean
  className?: string
}) {
  if (!hasChanges) return null

  return (
    <div
      role="status"
      data-testid="unsaved-changes-banner"
      className={`flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 text-sm ${className}`}
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <span>You have unsaved changes.</span>
      </div>
      <div className="flex items-center gap-2">
        {onDiscard && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDiscard}
            disabled={isSaving}
            className="text-xs h-7 text-amber-800 hover:text-amber-950 dark:text-amber-300"
          >
            Discard
          </Button>
        )}
        {onSave && (
          <Button
            type="button"
            size="sm"
            onClick={onSave}
            isLoading={isSaving}
            className="text-xs h-7 bg-amber-600 hover:bg-amber-700 text-white"
          >
            Save changes
          </Button>
        )}
      </div>
    </div>
  )
}

