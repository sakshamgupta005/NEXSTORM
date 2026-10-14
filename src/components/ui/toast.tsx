'use client'

import * as React from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ToastType = 'info' | 'success' | 'warning' | 'error'

export interface ToastItem {
  id: string
  title: string
  description?: string
  type: ToastType
  durationMs?: number
}

interface ToastContextValue {
  toasts: ToastItem[]
  showToast: (toast: Omit<ToastItem, 'id'>) => string
  dismissToast: (id: string) => void
}

const ToastContext = React.createContext<ToastContextValue | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([])

  const dismissToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = React.useCallback(
    (toast: Omit<ToastItem, 'id'>) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const newItem: ToastItem = { ...toast, id }

      setToasts((prev) => [...prev, newItem])

      const duration = toast.durationMs ?? 4000
      if (duration > 0) {
        setTimeout(() => {
          dismissToast(id)
        }, duration)
      }

      return id
    },
    [dismissToast]
  )

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
      <div
        aria-live="polite"
        role="region"
        aria-label="Notifications"
        className="fixed bottom-4 right-4 z-50 flex flex-col space-y-2 max-w-sm w-full pointer-events-none"
      >
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={() => dismissToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = React.useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastItem
  onDismiss: () => void
}) {
  const icons = {
    info: <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />,
    success: <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />,
    warning: <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />,
    error: <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />,
  }

  const borderStyles = {
    info: 'border-blue-200 dark:border-blue-900 bg-blue-50/90 dark:bg-blue-950/90',
    success: 'border-emerald-200 dark:border-emerald-900 bg-emerald-50/90 dark:bg-emerald-950/90',
    warning: 'border-amber-200 dark:border-amber-900 bg-amber-50/90 dark:bg-amber-950/90',
    error: 'border-red-200 dark:border-red-900 bg-red-50/90 dark:bg-red-950/90',
  }

  return (
    <div
      role="status"
      className={cn(
        'pointer-events-auto flex items-start space-x-3 p-4 rounded-lg border shadow-md backdrop-blur-xs transition-all',
        borderStyles[toast.type]
      )}
    >
      <div className="mt-0.5">{icons[toast.type]}</div>
      <div className="flex-1 text-sm">
        <p className="font-semibold text-slate-900 dark:text-slate-100">{toast.title}</p>
        {toast.description && (
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{toast.description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded cursor-pointer"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
