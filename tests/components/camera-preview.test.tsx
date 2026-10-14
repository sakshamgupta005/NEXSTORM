import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react'
import { CameraPreview } from '@/components/vision/camera-preview'
import { useCamera } from '@/hooks/use-camera'

describe('Camera Preview & useCamera Hook', () => {
  let mockStopTrack: ReturnType<typeof vi.fn>
  let mockStream: MediaStream

  beforeEach(() => {
    vi.restoreAllMocks()
    mockStopTrack = vi.fn()
    mockStream = {
      getTracks: () => [
        { stop: mockStopTrack, kind: 'video' } as unknown as MediaStreamTrack,
      ],
    } as unknown as MediaStream

    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
      },
      writable: true,
      configurable: true,
    })
  })

  it('initializes useCamera in inactive state without auto-requesting camera', () => {
    const { result } = renderHook(() => useCamera())
    expect(result.current.isActive).toBe(false)
    expect(result.current.stream).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('starts camera stream, stops camera, and releases media tracks on unmount', async () => {
    const { result, unmount } = renderHook(() => useCamera())

    let started = false
    await act(async () => {
      started = await result.current.startCamera()
    })

    expect(started).toBe(true)
    expect(result.current.isActive).toBe(true)
    expect(result.current.stream).toBe(mockStream)

    // Unmount hook -> should release all active tracks
    unmount()
    expect(mockStopTrack).toHaveBeenCalled()
  })

  it('handles camera permission denial gracefully', async () => {
    const permError = new Error('Permission denied')
    permError.name = 'NotAllowedError'
    navigator.mediaDevices.getUserMedia = vi.fn().mockRejectedValue(permError)

    const { result } = renderHook(() => useCamera())

    let started = true
    await act(async () => {
      started = await result.current.startCamera()
    })

    expect(started).toBe(false)
    expect(result.current.isActive).toBe(false)
    expect(result.current.errorCode).toBe('PERMISSION_DENIED')
    expect(result.current.error).toContain('denied')
  })

  it('renders CameraPreview inactive state and handles start/stop lifecycle', async () => {
    render(<CameraPreview />)

    expect(screen.getByTestId('start-camera-btn')).toBeInTheDocument()
    expect(screen.getByText(/Camera is inactive/i)).toBeInTheDocument()

    // Start camera
    await act(async () => {
      fireEvent.click(screen.getByTestId('start-camera-btn'))
    })

    expect(screen.getByTestId('stop-camera-btn')).toBeInTheDocument()
    expect(screen.getByTestId('camera-video-feed')).toBeInTheDocument()
    expect(screen.getByText(/Live/i)).toBeInTheDocument()

    // Stop camera
    act(() => {
      fireEvent.click(screen.getByTestId('stop-camera-btn'))
    })

    expect(mockStopTrack).toHaveBeenCalled()
    expect(screen.getByTestId('start-camera-btn')).toBeInTheDocument()
  })

  it('renders bounding-box overlay when detections are passed', async () => {
    const mockDetections = [
      {
        label: 'person',
        confidence: 0.95,
        box: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
      },
    ]

    render(<CameraPreview detections={mockDetections} />)

    // Start camera to show video & overlays
    await act(async () => {
      fireEvent.click(screen.getByTestId('start-camera-btn'))
    })

    expect(screen.getByTestId('detection-overlay')).toBeInTheDocument()
    expect(screen.getByText(/person \(95%\)/i)).toBeInTheDocument()
    expect(screen.getByText(/1 objects detected/i)).toBeInTheDocument()
  })

  it('renders error banner when camera access is denied', async () => {
    const deniedErr = new Error('Permission denied')
    deniedErr.name = 'NotAllowedError'
    navigator.mediaDevices.getUserMedia = vi.fn().mockRejectedValue(deniedErr)

    render(<CameraPreview />)

    await act(async () => {
      fireEvent.click(screen.getByTestId('start-camera-btn'))
    })

    expect(screen.getByTestId('camera-error-banner')).toBeInTheDocument()
    expect(screen.getByText(/Camera Unavailable/i)).toBeInTheDocument()
    expect(screen.getByText(/denied/i)).toBeInTheDocument()
  })
})
