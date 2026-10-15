'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  BadgeAlert,
  Clock,
  Eye,
  Filter,
  KeyRound,
  MapPin,
  RefreshCw,
  Shield,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import type {
  ObservationLifecycleStatus,
  WaterloggingObservation,
  WaterloggingSeverity,
} from '@/lib/observations/types'

interface ObservationsPanelProps {
  cityId?: string
  onSelectObservation?: (obs: WaterloggingObservation) => void
  onOpenReportModal?: () => void
  refreshTrigger?: number
}

const STATUS_CONFIG: Record<
  ObservationLifecycleStatus,
  { label: string; badgeClass: string; icon: React.ElementType }
> = {
  submitted: {
    label: 'Submitted (Unreviewed)',
    badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    icon: Clock,
  },
  under_review: {
    label: 'Under Review',
    badgeClass: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
    icon: Eye,
  },
  corroborated: {
    label: 'Community Corroborated',
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    icon: BadgeAlert,
  },
  verified: {
    label: 'Independently Verified',
    badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    icon: ShieldCheck,
  },
  rejected: {
    label: 'Rejected / Disproven',
    badgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    icon: XCircle,
  },
  expired: {
    label: 'Expired / Stale',
    badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700',
    icon: Clock,
  },
}

const SEVERITY_COLORS: Record<WaterloggingSeverity, string> = {
  minor_curb: 'text-blue-600 dark:text-blue-400',
  moderate_ankle: 'text-amber-600 dark:text-amber-400',
  severe_knee_or_higher: 'text-orange-600 dark:text-orange-400',
  impassable_vehicles: 'text-rose-600 dark:text-rose-400 font-bold',
}

export function ObservationsPanel({
  cityId = 'amritsar',
  onSelectObservation,
  onOpenReportModal,
  refreshTrigger = 0,
}: ObservationsPanelProps) {
  const [observations, setObservations] = useState<WaterloggingObservation[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [moderatorKey, setModeratorKey] = useState<string>('')
  const [showModeratorTools, setShowModeratorTools] = useState<boolean>(false)
  const [moderatingId, setModeratingId] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    fetch(`/api/observations?cityId=${cityId}&limit=100`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch observations')
        return res.json()
      })
      .then((data) => {
        if (isMounted) {
          setObservations(data?.data?.observations || [])
          setIsLoading(false)
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Error loading observations')
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [cityId, refreshTrigger])

  const refetch = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/observations?cityId=${cityId}&limit=100`)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error?.message || 'Failed to fetch observations')
      setObservations(data?.data?.observations || [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error loading observations')
    } finally {
      setIsLoading(false)
    }
  }, [cityId])

  const handleVerify = async (id: string, status: 'verified' | 'rejected') => {
    if (!moderatorKey) {
      alert('Please enter your authorized reviewer token in Moderator Tools first.')
      return
    }

    setModeratingId(id)
    try {
      const res = await fetch(`/api/observations/${id}/verify`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${moderatorKey.trim()}`,
        },
        body: JSON.stringify({
          status,
          verifiedBy: 'Console Moderator',
          verificationMethod: 'field_inspection',
          verificationNotes: `Moderated via NEXSTORM console at ${new Date().toISOString()}`,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error?.message || 'Verification update failed.')
      }

      await refetch()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to moderate observation')
    } finally {
      setModeratingId(null)
    }
  }

  // Filter observations
  const filtered = observations.filter((obs) => {
    if (statusFilter === 'all') return true
    if (statusFilter === 'active_fresh') return !obs.freshness.isExpired && obs.lifecycleStatus !== 'rejected'
    return obs.lifecycleStatus === statusFilter
  })

  const verifiedCount = observations.filter((o) => o.lifecycleStatus === 'verified').length
  const corroboratedCount = observations.filter((o) => o.lifecycleStatus === 'corroborated').length
  const submittedCount = observations.filter((o) => o.lifecycleStatus === 'submitted').length

  return (
    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-500" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              Ground-Truth Observations & Reports
            </h3>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Empirical evidence layer across Amritsar. Distinguishes reported, corroborated, verified, and modeled risk.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onOpenReportModal && (
            <button
              onClick={onOpenReportModal}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow flex items-center gap-1.5 transition cursor-pointer"
            >
              <span>+ Report Waterlogging</span>
            </button>
          )}
          <button
            onClick={refetch}
            disabled={isLoading}
            aria-label="Refresh observations"
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats Summary Pill Bar */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/50 dark:border-emerald-800/50">
          <span className="text-[10px] text-emerald-700 dark:text-emerald-400 block font-medium">Verified</span>
          <span className="text-base font-bold text-emerald-900 dark:text-emerald-200">{verifiedCount}</span>
        </div>
        <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-800/50">
          <span className="text-[10px] text-amber-700 dark:text-amber-400 block font-medium">Corroborated</span>
          <span className="text-base font-bold text-amber-900 dark:text-amber-200">{corroboratedCount}</span>
        </div>
        <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200/50 dark:border-blue-800/50">
          <span className="text-[10px] text-blue-700 dark:text-blue-400 block font-medium">Pending Review</span>
          <span className="text-base font-bold text-blue-900 dark:text-blue-200">{submittedCount}</span>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        {[
          { id: 'all', label: `All (${observations.length})` },
          { id: 'active_fresh', label: 'Active Fresh' },
          { id: 'verified', label: 'Verified' },
          { id: 'corroborated', label: 'Corroborated' },
          { id: 'submitted', label: 'Submitted' },
          { id: 'expired', label: 'Expired' },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setStatusFilter(f.id)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition cursor-pointer ${
              statusFilter === f.id
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Moderator Auth Drawer Toggle */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => setShowModeratorTools(!showModeratorTools)}
          className="text-[11px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1 cursor-pointer"
        >
          <KeyRound className="w-3 h-3" />
          <span>{showModeratorTools ? 'Hide Reviewer Tools' : 'Reviewer / Municipal Moderator Tools'}</span>
        </button>

        {showModeratorTools && (
          <div className="mt-2 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-2 text-xs">
            <span className="font-semibold block text-slate-800 dark:text-slate-200">
              Authorized Reviewer Token
            </span>
            <input
              type="password"
              placeholder="Enter token (e.g. dev-reviewer)"
              value={moderatorKey}
              onChange={(e) => setModeratorKey(e.target.value)}
              className="w-full px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs focus:ring-1 focus:ring-blue-500 outline-none"
            />
            <span className="text-[10px] text-slate-500 block">
              Enables in-line verification and rejection of community reports with immutable reviewer audit logging.
            </span>
          </div>
        )}
      </div>

      {/* Observation Items List */}
      <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
        {isLoading && (
          <div className="py-8 text-center text-xs text-slate-500">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-1 text-blue-500" />
            <span>Loading observation evidence...</span>
          </div>
        )}

        {error && (
          <div role="alert" className="p-3 rounded-lg bg-rose-50 text-rose-800 text-xs border border-rose-200">
            {error}
          </div>
        )}

        {!isLoading && !error && filtered.length === 0 && (
          <div className="py-8 text-center text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
            <MapPin className="w-6 h-6 mx-auto mb-1.5 text-slate-400" />
            <span className="font-semibold block">No observations matching filter</span>
            <span className="text-[11px] text-slate-400">
              {statusFilter === 'all'
                ? 'Be the first to submit a community report across Amritsar.'
                : 'Try selecting a different filter above.'}
            </span>
          </div>
        )}

        {!isLoading &&
          !error &&
          filtered.map((obs) => {
            const statusConfig = STATUS_CONFIG[obs.lifecycleStatus] || STATUS_CONFIG.submitted
            const StatusIcon = statusConfig.icon

            return (
              <div
                key={obs.id}
                onClick={() => onSelectObservation && onSelectObservation(obs)}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-100/70 dark:hover:bg-slate-800/80 transition space-y-2 cursor-pointer text-xs"
              >
                {/* Top Row: Category, Severity & Status */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-bold text-slate-900 dark:text-slate-100 capitalize">
                      {obs.category.replace(/_/g, ' ')}
                    </span>
                    <span className={`ml-2 text-[11px] font-semibold ${SEVERITY_COLORS[obs.severity]}`}>
                      • {obs.severity.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border flex items-center gap-1 shrink-0 ${statusConfig.badgeClass}`}
                  >
                    <StatusIcon className="w-3 h-3" />
                    <span>{statusConfig.label}</span>
                  </span>
                </div>

                {/* Description if present */}
                {obs.description && (
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                    {obs.description}
                  </p>
                )}

                {/* Spatial Snapping & Grid Metadata */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500 font-mono">
                  <div>
                    <span className="text-slate-400">Cell:</span>{' '}
                    <span className="text-slate-700 dark:text-slate-300 font-semibold">
                      {obs.spatialMatch.cellId || 'Out of Grid'}
                    </span>
                  </div>
                  {obs.spatialMatch.roadSegmentId && (
                    <div>
                      <span className="text-slate-400">Road:</span>{' '}
                      <span className="text-slate-700 dark:text-slate-300">
                        {obs.spatialMatch.roadName || obs.spatialMatch.roadSegmentId.slice(0, 14)}
                      </span>
                      {obs.spatialMatch.distanceToRoadMeters !== null && (
                        <span> ({Math.round(obs.spatialMatch.distanceToRoadMeters)}m)</span>
                      )}
                    </div>
                  )}
                  <div>
                    <span className="text-slate-400">Coords:</span>{' '}
                    <span>
                      {obs.coordinates.lat.toFixed(4)}, {obs.coordinates.lng.toFixed(4)}
                    </span>
                  </div>
                </div>

                {/* Timestamps & Corroboration */}
                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>Observed: {new Date(obs.observedAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>

                  {obs.corroboration.corroborationCount > 1 && (
                    <span className="font-semibold text-amber-600 dark:text-amber-400">
                      👥 {obs.corroboration.corroborationCount} independent reports
                    </span>
                  )}
                </div>

                {/* Verification Audit Trail if verified */}
                {obs.verification.isVerified && (
                  <div className="p-2 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 text-[10px] text-emerald-800 dark:text-emerald-300 space-y-0.5">
                    <div className="font-semibold flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      <span>Verified via {obs.verification.verificationMethod?.replace(/_/g, ' ')}</span>
                    </div>
                    {obs.verification.verificationNotes && (
                      <p className="italic text-emerald-700 dark:text-emerald-400">
                        &ldquo;{obs.verification.verificationNotes}&rdquo;
                      </p>
                    )}
                    <div className="text-[9px] text-emerald-600 dark:text-emerald-400/80">
                      Verifier: {obs.verification.verifiedBy} • {obs.verification.verifiedAt ? new Date(obs.verification.verifiedAt).toLocaleDateString() : ''}
                    </div>
                  </div>
                )}

                {/* Moderator Actions (if moderator tools active) */}
                {showModeratorTools && obs.lifecycleStatus !== 'verified' && obs.lifecycleStatus !== 'rejected' && (
                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleVerify(obs.id, 'rejected')
                      }}
                      disabled={moderatingId === obs.id}
                      className="px-2 py-0.5 rounded bg-rose-100 hover:bg-rose-200 text-rose-800 text-[10px] font-semibold transition"
                    >
                      Reject Report
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleVerify(obs.id, 'verified')
                      }}
                      disabled={moderatingId === obs.id}
                      className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-semibold shadow transition"
                    >
                      Verify Incident
                    </button>
                  </div>
                )}
              </div>
            )
          })}
      </div>

      {/* Scientific Caveat Footer */}
      <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
        <strong>Integrity Policy:</strong> Waterlogging reports represent community observations. Unreported locations are not assumed flood-free, and citizen submissions do not alter calibrated hydraulic models without verified field review.
      </div>
    </div>
  )
}
