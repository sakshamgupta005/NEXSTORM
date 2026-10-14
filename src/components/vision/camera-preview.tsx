'use client'

/**
 * Reusable Camera Preview & Vision Feed Component
 * 
 * Capabilities:
 * - Live video preview connected to MediaStream
 * - Explicit user-controlled start, stop, and snapshot capture
 * - Error banner for permission denial and device absence
 * - Normalized bounding box overlay for real-time detected objects
 * - Accessible controls and ARIA status attributes
 */

import * as React from 'react'
import { useCamera } from '@/hooks/use-camera'
import type { DetectedObject } from '@/lib/vision/cv-types'
import { Button } from '@/components/ui/button'

export interface CameraPreviewProps {
  /** Optional callback fired when the user captures a discrete frame */
  onCapture?: (base64Image: string) => void
  /** Optional list of detected objects to render as bounding-box overlays */
  detections?: DetectedObject[]
  /** Additional CSS class names */
  className?: string
  /** Custom aspect ratio / container styling */
  aspectRatio?: 'video' | 'square'
}

export function CameraPreview({
  onCapture,
  detections = [],
  className = '',
  aspectRatio = 'video',
}: CameraPreviewProps) {
  const {
    stream,
    isActive,
    isLoading,
    error,
    startCamera,
    stopCamera,
    captureFrame,
  } = useCamera()

  const videoRef = React.useRef<HTMLVideoElement | null>(null)

  // Attach MediaStream to the video element
  React.useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  const handleCapture = () => {
    const frame = captureFrame(videoRef.current)
    if (frame && onCapture) {
      onCapture(frame)
    }
  }

  const ratioClass = aspectRatio === 'square' ? 'aspect-square' : 'aspect-video'

  return (
    <div
      className={`relative flex flex-col rounded-xl border border-neutral-200 bg-neutral-900 overflow-hidden shadow-sm ${className}`}
      data-testid="camera-preview-container"
    >
      {/* Video Viewport & Overlays */}
      <div className={`relative w-full ${ratioClass} bg-black flex items-center justify-center overflow-hidden`}>
        {isActive ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              data-testid="camera-video-feed"
            />

            {/* Bounding Box Overlays */}
            {detections.length > 0 && (
              <div
                className="absolute inset-0 pointer-events-none"
                data-testid="detection-overlay"
              >
                {detections.map((det, idx) => {
                  const left = `${Math.round(det.box.x * 100)}%`
                  const top = `${Math.round(det.box.y * 100)}%`
                  const width = `${Math.round(det.box.width * 100)}%`
                  const height = `${Math.round(det.box.height * 100)}%`

                  return (
                    <div
                      key={`det_${idx}_${det.label}`}
                      className="absolute border-2 border-emerald-400 bg-emerald-400/20 rounded transition-all"
                      style={{ left, top, width, height }}
                    >
                      <span className="absolute -top-6 left-0 bg-emerald-500 text-white text-xs font-semibold px-1.5 py-0.5 rounded shadow">
                        {det.label} ({Math.round(det.confidence * 100)}%)
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        ) : (
          <div className="text-center p-6 text-neutral-400">
            {error ? (
              <div
                className="max-w-xs mx-auto text-rose-400 text-sm font-medium"
                role="alert"
                data-testid="camera-error-banner"
              >
                <p className="font-semibold text-rose-300">Camera Unavailable</p>
                <p className="mt-1 text-xs">{error}</p>
              </div>
            ) : (
              <p className="text-sm">Camera is inactive. Click &quot;Start Camera&quot; to begin.</p>
            )}
          </div>
        )}

        {/* Live indicator badge */}
        {isActive && (
          <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur text-xs font-medium text-emerald-400 border border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Live
          </div>
        )}
      </div>

      {/* Camera Controls Toolbar */}
      <div className="flex items-center justify-between gap-3 p-3 bg-neutral-950 border-t border-neutral-800 text-white">
        <div className="flex items-center gap-2">
          {!isActive ? (
            <Button
              type="button"
              size="sm"
              isLoading={isLoading}
              onClick={() => void startCamera()}
              data-testid="start-camera-btn"
            >
              Start Camera
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={stopCamera}
              data-testid="stop-camera-btn"
            >
              Stop Camera
            </Button>
          )}

          {isActive && onCapture && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={handleCapture}
              data-testid="capture-frame-btn"
            >
              Capture Frame
            </Button>
          )}
        </div>

        <span className="text-xs text-neutral-400">
          {isActive ? `${detections.length} objects detected` : 'Disconnected'}
        </span>
      </div>
    </div>
  )
}
