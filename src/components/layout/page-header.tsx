'use client'

import React from 'react'
import Link from 'next/link'
import { ChevronRight, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface BreadcrumbItem {
  label: string
  href?: string
}

export interface PageHeaderProps {
  title: React.ReactNode
  description?: React.ReactNode
  breadcrumbs?: BreadcrumbItem[]
  backHref?: string
  backLabel?: string
  actions?: React.ReactNode
  badge?: React.ReactNode
  className?: string
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  backHref,
  backLabel = 'Back',
  actions,
  badge,
  className = '',
}: PageHeaderProps) {
  return (
    <header className={`space-y-3 pb-6 border-b border-slate-200 dark:border-slate-800 ${className}`}>
      {/* Breadcrumbs or Back Link */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="flex items-center text-xs text-slate-500 dark:text-slate-400">
          <ol className="flex items-center flex-wrap gap-1.5 list-none p-0 m-0">
            {breadcrumbs.map((item, index) => {
              const isLast = index === breadcrumbs.length - 1
              return (
                <li key={index} className="flex items-center gap-1.5">
                  {index > 0 && <ChevronRight className="h-3 w-3 text-slate-400 shrink-0" aria-hidden="true" />}
                  {item.href && !isLast ? (
                    <Link
                      href={item.href}
                      className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <span
                      aria-current={isLast ? 'page' : undefined}
                      className={isLast ? 'font-medium text-slate-900 dark:text-slate-100' : ''}
                    >
                      {item.label}
                    </span>
                  )}
                </li>
              )
            })}
          </ol>
        </nav>
      )}

      {backHref && (!breadcrumbs || breadcrumbs.length === 0) && (
        <div>
          <Link href={backHref}>
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2 h-7 px-2 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
              {backLabel}
            </Button>
          </Link>
        </div>
      )}

      {/* Main Header Row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {title}
            </h1>
            {badge && <div>{badge}</div>}
          </div>
          {description && (
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
              {description}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex items-center flex-wrap gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </header>
  )
}
