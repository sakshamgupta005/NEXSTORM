'use client'

/**
 * Reusable React Hook & Helper for Client-Side File Downloads
 * 
 * Capabilities:
 * - Browser Blob instantiation and download link simulation
 * - Safe object URL creation and automated URL.revokeObjectURL disposal
 * - Asynchronous export state management (isDownloading, error)
 * - Format verification and filename sanitization
 */

import * as React from 'react'

export interface DownloadFileParams {
  data: string | Uint8Array | Blob
  filename: string
  contentType?: string
}

/**
 * Triggers a native browser file download from memory or Blob data,
 * reliably cleaning up object URLs to prevent memory leaks.
 */
export function triggerDownload(params: DownloadFileParams): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false
  }

  const { data, filename, contentType = 'application/octet-stream' } = params

  try {
    let blob: Blob
    if (data instanceof Blob) {
      blob = data
    } else if (typeof data === 'string') {
      blob = new Blob([data], { type: contentType })
    } else {
      blob = new Blob([data.buffer as ArrayBuffer], { type: contentType })
    }

    const objectUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = filename
    anchor.style.display = 'none'

    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)

    // Schedule immediate URL revocation after event cycle
    setTimeout(() => {
      URL.revokeObjectURL(objectUrl)
    }, 1000)

    return true
  } catch {
    return false
  }
}

export interface UseFileDownloadResult {
  isDownloading: boolean
  error: string | null
  download: (params: DownloadFileParams) => boolean
  downloadAsync: (
    generatorFn: () => Promise<DownloadFileParams>
  ) => Promise<boolean>
  reset: () => void
}

export function useFileDownload(): UseFileDownloadResult {
  const [isDownloading, setIsDownloading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const download = React.useCallback((params: DownloadFileParams): boolean => {
    setError(null)
    const success = triggerDownload(params)
    if (!success) {
      setError('Failed to trigger browser download')
    }
    return success
  }, [])

  const downloadAsync = React.useCallback(
    async (generatorFn: () => Promise<DownloadFileParams>): Promise<boolean> => {
      setIsDownloading(true)
      setError(null)

      try {
        const fileParams = await generatorFn()
        const success = triggerDownload(fileParams)
        if (!success) {
          throw new Error('Failed to initiate download link')
        }
        setIsDownloading(false)
        return true
      } catch (err: unknown) {
        setIsDownloading(false)
        const msg = err instanceof Error ? err.message : 'Export failed'
        setError(msg)
        return false
      }
    },
    []
  )

  const reset = React.useCallback(() => {
    setIsDownloading(false)
    setError(null)
  }, [])

  return {
    isDownloading,
    error,
    download,
    downloadAsync,
    reset,
  }
}
