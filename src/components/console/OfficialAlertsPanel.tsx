'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { SachetAlert } from '@/lib/weather/types'
import type { OfficialAlertsApiResponse } from '@/app/api/official-alerts/route'
import {
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  ShieldAlert,
  CheckCircle2,
  Building2,
  Clock,
} from 'lucide-react'

export function OfficialAlertsPanel() {
  const [alerts, setAlerts] = useState<SachetAlert[]>([])
  const [status, setStatus] = useState<'ok' | 'unavailable' | 'loading'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  useEffect(() => {
    let isMounted = true

    fetch('/api/official-alerts?state=punjab')
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok || !json.success) {
          throw new Error(json.error?.message || 'Failed to fetch official alerts')
        }
        if (isMounted) {
          const data: OfficialAlertsApiResponse = json.data
          setAlerts(data.alerts || [])
          setStatus(data.status)
          setLastChecked(new Date())
          setError(null)
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to connect to official alerts service')
          setStatus('unavailable')
          setLastChecked(new Date())
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  const handleRefresh = () => {
    setStatus('loading')
    setError(null)

    fetch('/api/official-alerts?state=punjab')
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok || !json.success) {
          throw new Error(json.error?.message || 'Failed to fetch official alerts')
        }
        const data: OfficialAlertsApiResponse = json.data
        setAlerts(data.alerts || [])
        setStatus(data.status)
        setLastChecked(new Date())
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to connect to official alerts service')
        setStatus('unavailable')
        setLastChecked(new Date())
      })
  }

  const getSeverityBadgeVariant = (severity?: string) => {
    const s = (severity || '').toLowerCase()
    if (s.includes('extreme') || s.includes('severe')) return 'danger'
    if (s.includes('moderate') || s.includes('warning')) return 'warning'
    return 'outline'
  }

  return (
    <Card className="border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-sm">
      <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-rose-500" />
              <span>Official Government Advisories</span>
            </CardTitle>
            <Badge variant="outline" className="text-[10px] font-mono">
              NDMA SACHET CAP
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            {lastChecked && (
              <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                Checked: {lastChecked.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={status === 'loading'}
              className="h-6 px-2 text-[10px] text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${status === 'loading' ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-3">
        {/* Authoritative Distinction Notice */}
        <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
          <div className="flex items-start gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
            <span>
              <strong>Statutory Authority Distinction:</strong> Alerts shown here originate directly from the National Disaster Management Authority (NDMA SACHET CAP feed) and IMD bulletins. NEXSTORM experimental risk scores are research models only and are never merged into official warnings.
            </span>
          </div>
        </div>

        {/* Loading State */}
        {status === 'loading' && (
          <div className="py-6 text-center text-slate-500 space-y-2">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs">Polling NDMA SACHET CAP gateway for Punjab...</p>
          </div>
        )}

        {/* Upstream Unavailable State */}
        {status === 'unavailable' && (
          <div
            role="alert"
            className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs space-y-1"
          >
            <div className="flex items-center gap-1.5 font-semibold">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>Official Advisory Gateway Stale or Unavailable</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              {error ||
                'The NDMA SACHET feed is currently unreachable. Live emergency feeds could not be verified. Refer directly to mausam.imd.gov.in and sachet.ndma.gov.in.'}
            </p>
          </div>
        )}

        {/* Empty State: No active alerts */}
        {status === 'ok' && alerts.length === 0 && (
          <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <div>
              <strong>No Active Weather Warnings:</strong> There are currently no active heavy rainfall or waterlogging CAP emergency bulletins issued by NDMA SACHET for Punjab.
            </div>
          </div>
        )}

        {/* Active Alerts List */}
        {status === 'ok' && alerts.length > 0 && (
          <div className="space-y-2.5">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                      {alert.event}
                    </span>
                    {alert.author && (
                      <span className="block text-[10px] text-slate-400">
                        Issued by: {alert.author}
                      </span>
                    )}
                  </div>
                  {alert.severity && (
                    <Badge variant={getSeverityBadgeVariant(alert.severity)} className="text-[10px] uppercase">
                      {alert.severity}
                    </Badge>
                  )}
                </div>

                {alert.areaDescription && (
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                    <strong>Affected Area:</strong> {alert.areaDescription}
                  </p>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>
                      {alert.effective ? `Effective: ${new Date(alert.effective).toLocaleDateString()}` : 'Active'}
                      {alert.expires ? ` · Until: ${new Date(alert.expires).toLocaleDateString()}` : ''}
                    </span>
                  </div>

                  {alert.link && (
                    <a
                      href={alert.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-semibold underline hover:text-blue-800"
                    >
                      <span>Official Source Bulletin</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
