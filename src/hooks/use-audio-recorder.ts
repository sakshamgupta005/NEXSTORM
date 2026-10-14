'use client'

/**
 * Reusable Browser Audio Recording Hook
 * 
 * Capabilities:
 * - Requests microphone permission ONLY on user action (never silently or on mount)
 * - Clean MediaRecorder lifecycle (start, pause, resume, stop, cancel)
 * - Releases microphone tracks immediately upon stop or component unmount
 * - Provides recording review (Blob, Object URL, duration) and discard options
 * - Graceful error handling for permission denial and missing microphones
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import type { AudioRecording, RecordingState } from '../lib/speech/types'

export interface UseAudioRecorderOptions {
  mimeType?: string
  maxDurationMs?: number
  onRecordingComplete?: (recording: AudioRecording) => void
  onError?: (error: Error) => void
}

export interface UseAudioRecorderResult {
  state: RecordingState
  isRecording: boolean
  isPaused: boolean
  durationMs: number
  recording: AudioRecording | null
  error: string | null
  startRecording: () => Promise<void>
  stopRecording: () => void
  pauseRecording: () => void
  resumeRecording: () => void
  cancelRecording: () => void
  clearRecording: () => void
}

export function useAudioRecorder(
  options: UseAudioRecorderOptions = {}
): UseAudioRecorderResult {
  const [state, setState] = useState<RecordingState>('idle')
  const [durationMs, setDurationMs] = useState(0)
  const [recording, setRecording] = useState<AudioRecording | null>(null)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(0)
  const pausedTimeRef = useRef<number>(0)

  // Options ref to avoid recreation of callbacks
  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  })

  // Cleanup helper to stop all tracks
  const stopTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop()
        } catch {
          // Ignore track stop errors
        }
      })
      streamRef.current = null
    }
  }, [])

  // Clear timer
  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // Unmount cleanup
  useEffect(() => {
    return () => {
      clearTimer()
      stopTracks()
      if (recording?.url) {
        try {
          URL.revokeObjectURL(recording.url)
        } catch {
          // Ignore revoke error
        }
      }
    }
  }, [clearTimer, stopTracks, recording?.url])

  const startRecording = useCallback(async () => {
    if (typeof window === 'undefined') return

    if (!navigator?.mediaDevices?.getUserMedia) {
      const err = 'Audio recording is not supported in this browser environment.'
      setError(err)
      setState('error')
      optionsRef.current.onError?.(new Error(err))
      return
    }

    try {
      setError(null)
      chunksRef.current = []

      // Request mic permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Pick supported mime type
      let selectedMimeType = optionsRef.current.mimeType || ''
      if (!selectedMimeType && typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          selectedMimeType = 'audio/webm;codecs=opus'
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          selectedMimeType = 'audio/webm'
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          selectedMimeType = 'audio/ogg'
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          selectedMimeType = 'audio/mp4'
        }
      }

      const recorder = selectedMimeType
        ? new MediaRecorder(stream, { mimeType: selectedMimeType })
        : new MediaRecorder(stream)

      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      recorder.onstop = () => {
        const mime = recorder.mimeType || selectedMimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: mime })
        const url = URL.createObjectURL(blob)
        const totalDuration = Date.now() - startTimeRef.current

        const rec: AudioRecording = {
          blob,
          url,
          durationMs: Math.max(0, totalDuration),
          mimeType: mime,
          byteLength: blob.size,
        }

        setRecording(rec)
        setState('stopped')
        stopTracks()
        clearTimer()
        optionsRef.current.onRecordingComplete?.(rec)
      }

      recorder.onerror = (e: Event) => {
        const customErr = e as unknown as { error?: Error }
        const msg = customErr?.error?.message || 'Recording encountered an error'
        setError(msg)
        setState('error')
        stopTracks()
        clearTimer()
        optionsRef.current.onError?.(new Error(msg))
      }

      // Start recording
      recorder.start(250) // Slice every 250ms
      startTimeRef.current = Date.now()
      setState('recording')

      // Duration counter
      clearTimer()
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current
        setDurationMs(elapsed)

        if (
          optionsRef.current.maxDurationMs &&
          elapsed >= optionsRef.current.maxDurationMs
        ) {
          if (recorder.state === 'recording') {
            recorder.stop()
          }
        }
      }, 100)
    } catch (err: unknown) {
      stopTracks()
      clearTimer()
      let friendlyError = 'Failed to access microphone'
      const errName =
        err && typeof err === 'object' && 'name' in err
          ? String((err as { name?: unknown }).name)
          : ''
      const errMsg = err instanceof Error ? err.message : String(err)

      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        friendlyError = 'Microphone permission was denied. Please allow microphone access.'
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        friendlyError = 'No microphone device was found on this system.'
      } else if (errMsg && errMsg !== '[object Object]') {
        friendlyError = errMsg
      }

      setError(friendlyError)
      setState('error')
      optionsRef.current.onError?.(new Error(friendlyError))
    }
  }, [clearTimer, stopTracks])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop()
      } catch {
        // Fallback
      }
    }
    clearTimer()
  }, [clearTimer])

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause()
      pausedTimeRef.current = Date.now()
      setState('paused')
      clearTimer()
    }
  }, [clearTimer])

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume()
      setState('recording')
      startTimeRef.current += Date.now() - pausedTimeRef.current

      clearTimer()
      timerRef.current = setInterval(() => {
        setDurationMs(Date.now() - startTimeRef.current)
      }, 100)
    }
  }, [clearTimer])

  const cancelRecording = useCallback(() => {
    chunksRef.current = []
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop()
      } catch {
        // Ignore
      }
    }
    stopTracks()
    clearTimer()
    setState('idle')
    setDurationMs(0)
    setError(null)
  }, [clearTimer, stopTracks])

  const clearRecording = useCallback(() => {
    if (recording?.url) {
      try {
        URL.revokeObjectURL(recording.url)
      } catch {
        // Ignore
      }
    }
    setRecording(null)
    setDurationMs(0)
    setState('idle')
    setError(null)
  }, [recording])

  return {
    state,
    isRecording: state === 'recording',
    isPaused: state === 'paused',
    durationMs,
    recording,
    error,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
    clearRecording,
  }
}
