import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAudioRecorder } from '@/hooks/use-audio-recorder'

describe('useAudioRecorder Hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('initializes in idle state without requesting microphone on mount', () => {
    const { result } = renderHook(() => useAudioRecorder())
    expect(result.current.state).toBe('idle')
    expect(result.current.isRecording).toBe(false)
    expect(result.current.recording).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('handles microphone permission denial gracefully', async () => {
    const error = new Error('Permission denied')
    error.name = 'NotAllowedError'
    const mockGetUserMedia = vi.fn().mockRejectedValue(error)

    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: mockGetUserMedia },
      writable: true,
      configurable: true,
    })

    const { result } = renderHook(() => useAudioRecorder())

    await act(async () => {
      await result.current.startRecording()
    })

    expect(result.current.state).toBe('error')
    expect(result.current.error).toContain('permission was denied')
  })

  it('handles missing microphone device gracefully', async () => {
    const error = new Error('No device found')
    error.name = 'NotFoundError'
    const mockGetUserMedia = vi.fn().mockRejectedValue(error)

    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: mockGetUserMedia },
      writable: true,
      configurable: true,
    })

    const { result } = renderHook(() => useAudioRecorder())

    await act(async () => {
      await result.current.startRecording()
    })

    expect(result.current.state).toBe('error')
    expect(result.current.error).toContain('No microphone device was found')
  })

  it('starts and stops recording releasing media tracks', async () => {
    const mockTrack = { stop: vi.fn() }
    const mockStream = {
      getTracks: vi.fn().mockReturnValue([mockTrack]),
    }
    const mockGetUserMedia = vi.fn().mockResolvedValue(mockStream)

    // Mock MediaRecorder
    class MockMediaRecorder {
      state = 'inactive'
      mimeType = 'audio/webm'
      ondataavailable: ((e: { data: Blob }) => void) | null = null
      onstop: (() => void) | null = null
      onerror: ((e: Event) => void) | null = null

      static isTypeSupported = vi.fn().mockReturnValue(true)

      start() {
        this.state = 'recording'
      }

      stop() {
        this.state = 'inactive'
        if (this.ondataavailable) {
          this.ondataavailable({ data: new Blob(['audio-content'], { type: 'audio/webm' }) })
        }
        if (this.onstop) {
          this.onstop()
        }
      }

      pause() {
        this.state = 'paused'
      }

      resume() {
        this.state = 'recording'
      }
    }

    Object.defineProperty(globalThis, 'MediaRecorder', {
      value: MockMediaRecorder,
      writable: true,
      configurable: true,
    })

    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: mockGetUserMedia },
      writable: true,
      configurable: true,
    })

    // Mock URL.createObjectURL
    globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/test')
    globalThis.URL.revokeObjectURL = vi.fn()

    const { result, unmount } = renderHook(() => useAudioRecorder())

    await act(async () => {
      await result.current.startRecording()
    })

    expect(result.current.state).toBe('recording')
    expect(result.current.isRecording).toBe(true)

    act(() => {
      result.current.stopRecording()
    })

    expect(result.current.state).toBe('stopped')
    expect(result.current.recording).toBeDefined()
    expect(result.current.recording?.url).toBe('blob:http://localhost/test')
    expect(mockTrack.stop).toHaveBeenCalled()

    // Test unmount releases tracks and resources
    unmount()
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalled()
  })
})
