'use client'

import * as React from 'react'
import {
  Languages,
  Plus,
  Minus,
  Megaphone,
  CheckCircle2,
  ShieldCheck,
  Calendar,
  DollarSign,
  Hash,
  Eye,
  AlertTriangle,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n/context'
import { LanguageSwitcher } from './language-switcher'
import { useAnnounce } from '@/lib/a11y/announcer'
import { usePrefersReducedMotion } from '@/lib/a11y/reduced-motion'
import { runA11yAudit } from '@/lib/a11y/audit'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export function LocaleDemo() {
  const {
    locale,
    direction,
    currentLocaleMeta,
    t,
    formatDate,
    formatNumber,
    formatCurrency,
    formatRelativeTime,
  } = useI18n()

  const { announce } = useAnnounce()
  const prefersReduced = usePrefersReducedMotion()

  const [itemCount, setItemCount] = React.useState(1)
  const [auditResult, setAuditResult] = React.useState<{
    passes: boolean
    summary: string
    violationsCount: number
  } | null>(null)
  const [isRunningAudit, setIsRunningAudit] = React.useState(false)

  const sampleDate = React.useMemo(() => new Date('2026-10-12T14:30:00Z'), [])
  const sampleAmount = 124850.5
  const sampleNumber = 14250.75

  const handleAnnounceTest = () => {
    const msg = `System update completed successfully in ${currentLocaleMeta.name}`
    announce(msg, 'polite')
  }

  const handleRunAudit = async () => {
    setIsRunningAudit(true)
    try {
      const result = await runA11yAudit()
      setAuditResult({
        passes: result.passes,
        summary: result.summary,
        violationsCount: result.totalViolations,
      })
    } finally {
      setIsRunningAudit(false)
    }
  }

  return (
    <div className="space-y-6" data-testid="locale-demo" dir={direction}>
      {/* Notice Banner */}
      <div className="flex items-center justify-between p-4 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 text-xs text-blue-900 dark:text-blue-300">
        <div className="flex items-center gap-2.5">
          <Languages className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
          <div>
            <p className="font-semibold text-sm">
              Internationalization (i18n), Localization (l10n) & Accessibility (a11y)
            </p>
            <p className="text-blue-700 dark:text-blue-400 mt-0.5">
              Live multilingual translation, pluralization, locale-aware formatting, and screen reader live regions.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs uppercase">
            {direction.toUpperCase()}
          </Badge>
          <LanguageSwitcher variant="dropdown" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Translations & Pluralization */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Languages className="h-4 w-4 text-blue-600" />
                <span>{t('analytics.title')}</span>
              </CardTitle>
              <Badge variant="secondary" className="font-mono text-[10px]">
                {locale} ({currentLocaleMeta.nativeName})
              </Badge>
            </div>
            <CardDescription>{t('analytics.description')}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 text-sm">
            {/* Interpolated greeting */}
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
                Variable Interpolation:
              </span>
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                {t('common.welcome', { name: 'Alex Rivera' })}
              </p>
            </div>

            {/* Dynamic Pluralization */}
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Pluralization Rules:
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => setItemCount((prev) => Math.max(0, prev - 1))}
                    aria-label="Decrease item count"
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-6 text-center font-mono text-xs font-semibold">
                    {itemCount}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => setItemCount((prev) => prev + 1)}
                    aria-label="Increase item count"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <p className="font-medium text-blue-600 dark:text-blue-400">
                {t('items', { count: itemCount })}
              </p>
            </div>

            {/* Language Switcher Buttons */}
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 block mb-2">
                Quick Locale Switch:
              </span>
              <LanguageSwitcher variant="pills" />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Locale-Aware Formatting */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-600" />
              <span>Locale-Aware Formatting</span>
            </CardTitle>
            <CardDescription>
              Automatic currency symbols, digit grouping, and timezone formatting.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3.5 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <DollarSign className="h-3.5 w-3.5 text-slate-400" />
                <span>{t('analytics.revenue')}:</span>
              </div>
              <span className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100">
                {formatCurrency(sampleAmount)}
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <Hash className="h-3.5 w-3.5 text-slate-400" />
                <span>{t('analytics.users')}:</span>
              </div>
              <span className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100">
                {formatNumber(sampleNumber, { decimals: 0 })}
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                <span>Formatted Timestamp:</span>
              </div>
              <span className="font-mono text-slate-700 dark:text-slate-300">
                {formatDate(sampleDate, {
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZoneName: 'short',
                })}
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-slate-600 dark:text-slate-300">Relative Time:</span>
              <span className="font-mono text-slate-700 dark:text-slate-300">
                {formatRelativeTime(-2, 'hour')}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Accessibility & Screen Reader Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-blue-600" />
            <span>Accessibility (a11y) & Screen Reader Region</span>
          </CardTitle>
          <CardDescription>
            Live region announcements, reduced-motion preferences, and automated WCAG evaluation.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAnnounceTest}
              className="gap-2 text-xs"
              aria-label="Trigger screen reader polite announcement"
            >
              <Megaphone className="h-3.5 w-3.5 text-blue-600" />
              <span>Trigger Screen-Reader Announce</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRunAudit}
              disabled={isRunningAudit}
              className="gap-2 text-xs"
              aria-label="Run automated accessibility scan"
            >
              <Eye className="h-3.5 w-3.5 text-purple-600" />
              <span>{isRunningAudit ? 'Scanning...' : 'Run Automated a11y Scan'}</span>
            </Button>

            <Badge variant="outline" className="text-xs gap-1.5 py-1 px-2.5">
              <span>Reduced Motion:</span>
              <strong>{prefersReduced ? 'Enabled' : 'Default'}</strong>
            </Badge>
          </div>

          {auditResult && (
            <div
              className={cn(
                'p-3 rounded-lg border text-xs',
                auditResult.passes
                  ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                  : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'
              )}
            >
              <div className="flex items-center gap-2 font-semibold">
                {auditResult.passes ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                )}
                <span>Audit Summary</span>
              </div>
              <p className="mt-1">{auditResult.summary}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
