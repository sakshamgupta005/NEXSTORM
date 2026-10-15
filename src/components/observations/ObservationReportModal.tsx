'use client'

import React, { useState } from 'react'
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock,
  Droplets,
  Loader2,
  MapPin,
  Send,
  ShieldAlert,
  X,
} from 'lucide-react'
import type { WaterloggingCategory, WaterloggingSeverity } from '@/lib/observations/types'

interface ObservationReportModalProps {
  isOpen: boolean
  onClose: () => void
  cityId?: string
  initialCoordinates?: { lat: number; lng: number }
  onObservationSubmitted?: () => void
}

const CATEGORIES: { value: WaterloggingCategory; label: string; desc: string }[] = [
  { value: 'street_flooding', label: 'Street Flooding', desc: 'Water covering entire road carriageway' },
  { value: 'underpass_submersion', label: 'Underpass Submersion', desc: 'Railway/road underpass filled with water' },
  { value: 'drain_overflow', label: 'Drain / Nullah Overflow', desc: 'Storm drain or sewer overflowing into street' },
  { value: 'ponding', label: 'Ponding / Puddle', desc: 'Localized accumulation at road shoulder/curb' },
  { value: 'receding_water', label: 'Receding / Cleared', desc: 'Water has cleared; road is now passable' },
]

const SEVERITIES: { value: WaterloggingSeverity; label: string; desc: string; color: string }[] = [
  { value: 'minor_curb', label: 'Minor (Curb Level)', desc: '<10 cm — Passable for all vehicles', color: 'border-blue-400 bg-blue-50 text-blue-900 dark:bg-blue-950/40 dark:text-blue-300' },
  { value: 'moderate_ankle', label: 'Moderate (Ankle-Deep)', desc: '10–20 cm — Slow traffic, 2-wheelers affected', color: 'border-amber-400 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-300' },
  { value: 'severe_knee_or_higher', label: 'Severe (Knee-Deep)', desc: '20–50 cm — Impassable for cars/two-wheelers', color: 'border-orange-500 bg-orange-50 text-orange-900 dark:bg-orange-950/40 dark:text-orange-300' },
  { value: 'impassable_vehicles', label: 'Impassable (Submerged)', desc: '>50 cm — Vehicles stalled, road closed', color: 'border-rose-600 bg-rose-50 text-rose-900 dark:bg-rose-950/40 dark:text-rose-300' },
]

export function ObservationReportModal({
  isOpen,
  onClose,
  cityId = 'amritsar',
  initialCoordinates = { lat: 31.634, lng: 74.872 },
  onObservationSubmitted,
}: ObservationReportModalProps) {
  const [lat, setLat] = useState<string>(initialCoordinates.lat.toFixed(5))
  const [lng, setLng] = useState<string>(initialCoordinates.lng.toFixed(5))
  const [category, setCategory] = useState<WaterloggingCategory>('street_flooding')
  const [severity, setSeverity] = useState<WaterloggingSeverity>('moderate_ankle')
  const [observedAt, setObservedAt] = useState<string>(
    () => new Date(Date.now() - 5 * 60 * 1000).toISOString().slice(0, 16)
  )
  const [description, setDescription] = useState<string>('')
  const [photoUrl, setPhotoUrl] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successResult, setSuccessResult] = useState<{
    id: string
    cellId: string | null
    roadSegmentId: string | null
    corroborationCount: number
  } | null>(null)

  if (!isOpen) return null

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setErrorMessage('Geolocation is not supported by your browser.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(5))
        setLng(pos.coords.longitude.toFixed(5))
        setErrorMessage(null)
      },
      (err) => {
        setErrorMessage(`Could not obtain location: ${err.message}`)
      }
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setIsSubmitting(true)

    const parsedLat = parseFloat(lat)
    const parsedLng = parseFloat(lng)

    if (isNaN(parsedLat) || isNaN(parsedLng)) {
      setErrorMessage('Please enter valid numeric latitude and longitude coordinates.')
      setIsSubmitting(false)
      return
    }

    if (parsedLat < 31.50 || parsedLat > 31.80 || parsedLng < 74.70 || parsedLng > 75.05) {
      setErrorMessage('Coordinates must fall within the Amritsar pilot boundary (Lat: 31.50–31.80, Lng: 74.70–75.05).')
      setIsSubmitting(false)
      return
    }

    try {
      const payload = {
        cityId,
        coordinates: { lat: parsedLat, lng: parsedLng },
        observedAt: new Date(observedAt).toISOString(),
        category,
        severity,
        description: description.trim() || undefined,
        photoUrl: photoUrl.trim() || undefined,
      }

      const res = await fetch('/api/observations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error?.message || data?.message || 'Failed to submit observation.')
      }

      setSuccessResult({
        id: data.data.id,
        cellId: data.data.spatialMatch?.cellId || null,
        roadSegmentId: data.data.spatialMatch?.roadSegmentId || null,
        corroborationCount: data.data.corroboration?.corroborationCount || 1,
      })

      if (onObservationSubmitted) {
        onObservationSubmitted()
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'An error occurred during submission.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2">
            <Droplets className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 id="report-modal-title" className="text-base font-bold text-slate-900 dark:text-slate-100">
              Report Waterlogging Incident
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {successResult ? (
            <div className="space-y-4 py-2">
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 space-y-2">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Observation Submitted Successfully</span>
                </div>
                <p className="text-xs text-emerald-800 dark:text-emerald-300">
                  Your report has been entered into the Amritsar evidence registry under identifier{' '}
                  <span className="font-mono font-bold">{successResult.id}</span>.
                </p>
                <div className="pt-2 text-[11px] grid grid-cols-2 gap-2 border-t border-emerald-200/60 dark:border-emerald-800/60">
                  <div>
                    <span className="text-emerald-700 dark:text-emerald-400">Analysis Cell:</span>{' '}
                    <span className="font-mono font-semibold">{successResult.cellId || 'Unmatched'}</span>
                  </div>
                  <div>
                    <span className="text-emerald-700 dark:text-emerald-400">Road Snapping:</span>{' '}
                    <span className="font-mono font-semibold">{successResult.roadSegmentId ? 'Snapped (30m)' : 'None'}</span>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400 space-y-1">
                <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-amber-500" />
                  <span>Evidence & Integrity Guardrail</span>
                </div>
                <p>
                  Community submissions are tagged as <span className="font-semibold">submitted</span> and do not immediately affect predictive flood models. When corroborated by independent reports or field inspection, their status upgrades transparently.
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow transition"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Error Notice */}
              {errorMessage && (
                <div
                  role="alert"
                  className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2"
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Coordinates Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-blue-500" />
                    <span>Location Coordinates (WGS84)</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    Use my device location
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] text-slate-500 block mb-0.5">Latitude (31.50 – 31.80)</span>
                    <input
                      type="number"
                      step="0.00001"
                      required
                      value={lat}
                      onChange={(e) => setLat(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block mb-0.5">Longitude (74.70 – 75.05)</span>
                    <input
                      type="number"
                      step="0.00001"
                      required
                      value={lng}
                      onChange={(e) => setLng(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Waterlogging Category */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Incident Category
                </label>
                <div className="grid grid-cols-1 gap-1.5">
                  {CATEGORIES.map((c) => (
                    <label
                      key={c.value}
                      className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition text-xs ${
                        category === c.value
                          ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 text-blue-950 dark:text-blue-200'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="category"
                        value={c.value}
                        checked={category === c.value}
                        onChange={() => setCategory(c.value)}
                        className="mt-0.5 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <div className="font-semibold">{c.label}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">{c.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Observed Severity */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Reported Severity / Depth
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {SEVERITIES.map((s) => (
                    <label
                      key={s.value}
                      className={`p-2 rounded-lg border cursor-pointer transition text-xs flex flex-col justify-between ${
                        severity === s.value ? s.color + ' ring-1 ring-current' : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[11px]">{s.label}</span>
                        <input
                          type="radio"
                          name="severity"
                          value={s.value}
                          checked={severity === s.value}
                          onChange={() => setSeverity(s.value)}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">{s.desc}</div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Observed Time */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Observed Event Time</span>
                </label>
                <input
                  type="datetime-local"
                  required
                  value={observedAt}
                  onChange={(e) => setObservedAt(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <span className="text-[10px] text-slate-500 block">Must be within the last 7 days; cannot be in the future.</span>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Description / Landmark (Optional)
                </label>
                <textarea
                  rows={2}
                  maxLength={500}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Water accumulated outside Hall Gate flyover ramp; buses diverting."
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                />
              </div>

              {/* Optional Photo URL */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-slate-400" />
                  <span>Photo Reference URL (Optional)</span>
                </label>
                <input
                  type="url"
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  placeholder="https://example.com/photo.jpg"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <span className="text-[10px] text-slate-500 block">
                  Only secure http/https image URLs. Cloud file storage is currently offline in this environment.
                </span>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Validating & Submitting...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Submit Observation</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
