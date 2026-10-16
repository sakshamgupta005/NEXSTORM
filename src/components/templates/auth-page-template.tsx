'use client'

import React from 'react'
import Link from 'next/link'
import { AuthLayout } from '@/components/layout/app-shell'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

export interface AuthPageTemplateProps {
  title: string
  description?: string
  brandName?: string
  brandLogo?: React.ReactNode
  backHref?: string
  backLabel?: string
  error?: string | null
  successMessage?: string | null
  links?: Array<{ text: string; linkText: string; href: string }>
  footerNotes?: React.ReactNode
  children: React.ReactNode
  className?: string
}

export function AuthPageTemplate({
  title,
  description,
  brandName = 'Hackathon Starter',
  brandLogo,
  backHref = '/',
  backLabel = 'Back to Home',
  error = null,
  successMessage = null,
  links,
  footerNotes,
  children,
  className = '',
}: AuthPageTemplateProps) {
  return (
    <AuthLayout
      brandName={brandName}
      brandLogo={brandLogo}
      backHref={backHref}
      backLabel={backLabel}
      footer={footerNotes}
      className={className}
    >
      <div className="space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {title}
          </h1>
          {description && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {description}
            </p>
          )}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {successMessage && (
          <Alert className="border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <AlertDescription>{successMessage}</AlertDescription>
          </Alert>
        )}

        <div>{children}</div>

        {links && links.length > 0 && (
          <div className="space-y-2 text-center text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
            {links.map((item, idx) => (
              <div key={idx}>
                {item.text}{' '}
                <Link
                  href={item.href}
                  className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
                >
                  {item.linkText}
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </AuthLayout>
  )
}
