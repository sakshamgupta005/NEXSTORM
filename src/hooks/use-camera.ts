'use client'

/**
 * Reusable React Hook for Browser Camera Feeds & Frame Capture
 * 
 * Capabilities:
 * - Explicit user-initiated camera stream activation
 * - Immediate and reliable media track disposal on unmount or stop
 * - Safe browser compatibility check (SSR guard)
 * - Error classification (permission denied vs missing device)
 * - Canvas frame capture returning base64 JPEG data
 */

import * as React from 'react'

export type CameraErrorCode =
  | 'PERMISSION_DENIED'
  | 'DEVICE_NOT_FOUND'
  | 'UNSUPPORTED'
  | 'STREAM_ERROR'

export interface UseCameraOptions {
  /** Preferred video constraints (default: { video: { facingMode: 'user', width: { ideal: 1280 } } }) */
  constraints?: MediaStreamConstraints
  /** Callback fired when stream is successfully opened */
  onStart?: (stream: MediaStream) => void
  /** Callback fired when stream is stopped */
  onStop?: () => void
  /** Callback fired when camera access encounters an error */
  onError?: (errorCode: CameraErrorCode, message: string) => void
}

export interface UseCameraResult {
  stream: MediaStream | null
  isActive: boolean
  isLoading: boolean
  error: string | null
  errorCode: CameraErrorCode | null
  startCamera: (customConstraints?: MediaStreamConstraints) => Promise<boolean>
  stopCamera: () => void
  captureFrame: (videoElement?: HTMLVideoElement | null) => string | null
}

export function useCamera(options: UseCameraOptions = {}): UseCameraResult {
  const { constraints, onStart, onStop, onError } = options

  const [stream, setStream] = React.useState<MediaStream | null>(null)
  const [isActive, setIsActive] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [errorCode, setErrorCode] = React.useState<CameraErrorCode | null>(null)

  const streamRef = React.useRef<MediaStream | null>(null)
  const onStartRef = React.useRef(onStart)
  const onStopRef = React.useRef(onStop)
  const onErrorRef = React.useRef(onError)

  React.useEffect(() => {
    onStartRef.current = onStart
    onStopRef.current = onStop
    onErrorRef.current = onError
  })

  // Clean up all tracks on unmount
  React.useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
    }
  }, [])

  const stopCamera = React.useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setStream(null)
    setIsActive(false)
    setIsLoading(false)
    onStopRef.current?.()
  }, [])

  const startCamera = React.useCallback(
    async (customConstraints?: MediaStreamConstraints): Promise<boolean> => {
      // 1. Guard against SSR and environments without mediaDevices API
      if (
        typeof window === 'undefined' ||
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getUserMedia !== 'function'
      ) {
        const msg = 'Camera access is not supported by this browser or environment'
        setError(msg)
        setErrorCode('UNSUPPORTED')
        onErrorRef.current?.('UNSUPPORTED', msg)
        return false
      }

      // Stop existing stream if running
      stopCamera()
      setIsLoading(true)
      setError(null)
      setErrorCode(null)

      const activeConstraints: MediaStreamConstraints = customConstraints ||
        constraints || {
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        }

      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia(activeConstraints)
        streamRef.current = mediaStream
        setStream(mediaStream)
        setIsActive(true)
        setIsLoading(false)
        onStartRef.current?.(mediaStream)
        return true
      } catch (err: unknown) {
        setIsLoading(false)
        setIsActive(false)

        let code: CameraErrorCode = 'STREAM_ERROR'
        let message = 'Failed to access camera'

        if (err instanceof Error) {
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            code = 'PERMISSION_DENIED'
            message = 'Camera permission was denied by the user or system'
          } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
            code = 'DEVICE_NOT_FOUND'
            message = 'No compatible camera device was found on this system'
          } else {
            message = err.message || message
          }
        }

        setError(message)
        setErrorCode(code)
        onErrorRef.current?.(code, message)
        return false
      }
    },
    [constraints, stopCamera]
  )

  const captureFrame = React.useCallback(
    (videoElement?: HTMLVideoElement | null): string | null => {
      if (!videoElement || typeof document === 'undefined') {
        return null
      }

      try {
        const canvas = document.createElement('canvas')
        const width = videoElement.videoWidth || 640
        const height = videoElement.videoHeight || 480
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) return null

        ctx.drawImage(videoElement, 0, 0, width, height)
        return canvas.toDataURL('image/jpeg', 0.85)
      } catch {
        return null
      }
    },
    []
  )

  return {
    stream,
    isActive,
    isLoading,
    error,
    errorCode,
    startCamera,
    stopCamera,
    captureFrame,
  }
}
