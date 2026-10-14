import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFileDownload, triggerDownload } from '@/hooks/use-file-download'

describe('useFileDownload Hook & triggerDownload Helper', () => {
  let mockCreateObjectURL: ReturnType<typeof vi.fn>
  let mockRevokeObjectURL: ReturnType<typeof vi.fn>
  let appendChildSpy: ReturnType<typeof vi.fn>
  let removeChildSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.restoreAllMocks()

    mockCreateObjectURL = vi.fn().mockReturnValue('blob:http://localhost:3000/mock-uuid')
    mockRevokeObjectURL = vi.fn()

    global.URL.createObjectURL = mockCreateObjectURL as unknown as typeof URL.createObjectURL
    global.URL.revokeObjectURL = mockRevokeObjectURL as unknown as typeof URL.revokeObjectURL

    appendChildSpy = vi.spyOn(document.body, 'appendChild')
    removeChildSpy = vi.spyOn(document.body, 'removeChild')
  })

  it('triggers browser download link and creates/revokes object URL', () => {
    const success = triggerDownload({
      data: 'col1,col2\nval1,val2',
      filename: 'export.csv',
      contentType: 'text/csv',
    })

    expect(success).toBe(true)
    expect(mockCreateObjectURL).toHaveBeenCalled()
    expect(appendChildSpy).toHaveBeenCalled()
    expect(removeChildSpy).toHaveBeenCalled()
  })

  it('handles synchronous download via useFileDownload hook', () => {
    const { result } = renderHook(() => useFileDownload())

    expect(result.current.isDownloading).toBe(false)
    expect(result.current.error).toBeNull()

    act(() => {
      const success = result.current.download({
        data: '{"key": "value"}',
        filename: 'data.json',
        contentType: 'application/json',
      })
      expect(success).toBe(true)
    })

    expect(result.current.error).toBeNull()
  })

  it('manages isDownloading state during asynchronous generator export', async () => {
    const { result } = renderHook(() => useFileDownload())

    let promise: Promise<boolean>
    act(() => {
      promise = result.current.downloadAsync(async () => {
        return {
          data: 'sample content',
          filename: 'async_report.txt',
          contentType: 'text/plain',
        }
      })
    })

    expect(result.current.isDownloading).toBe(true)

    await act(async () => {
      await promise
    })

    expect(result.current.isDownloading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('captures generator errors and allows state reset', async () => {
    const { result } = renderHook(() => useFileDownload())

    await act(async () => {
      await result.current.downloadAsync(async () => {
        throw new Error('Database connection failed during export')
      })
    })

    expect(result.current.isDownloading).toBe(false)
    expect(result.current.error).toBe('Database connection failed during export')

    act(() => {
      result.current.reset()
    })

    expect(result.current.error).toBeNull()
  })
})
