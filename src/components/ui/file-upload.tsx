'use client'

import * as React from 'react'
import { UploadCloud, File as FileIcon, X, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './button'

export interface FileUploadProps {
  id?: string
  accept?: string
  maxSizeBytes?: number // e.g. 5 * 1024 * 1024 (5MB)
  allowedExtensions?: string[] // e.g. ['.png', '.jpg', '.pdf']
  onFileSelect?: (file: File | null) => void
  onUpload?: (file: File) => Promise<void>
  /** Progress reported from actual upload (0 to 100), optional */
  uploadProgress?: number
  isUploading?: boolean
  error?: string
  className?: string
  disabled?: boolean
  label?: string
  description?: string
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function FileUpload({
  id = 'file-upload',
  accept,
  maxSizeBytes = 5 * 1024 * 1024, // 5MB default
  allowedExtensions,
  onFileSelect,
  onUpload,
  uploadProgress,
  isUploading = false,
  error: externalError,
  className,
  disabled = false,
  label = 'Upload a file',
  description = 'Drag and drop or click to browse',
}: FileUploadProps) {
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null)
  const [validationError, setValidationError] = React.useState<string | null>(null)
  const [isDragOver, setIsDragOver] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const activeError = externalError || validationError

  const validateFile = (file: File): string | null => {
    // 1. Size check
    if (file.size > maxSizeBytes) {
      return `File size exceeds the limit of ${formatBytes(maxSizeBytes)}.`
    }

    // 2. Extension check
    if (allowedExtensions && allowedExtensions.length > 0) {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase()
      const isAllowed = allowedExtensions.some(
        (allowed) => allowed.toLowerCase() === ext
      )
      if (!isAllowed) {
        return `File type not supported. Allowed extensions: ${allowedExtensions.join(', ')}.`
      }
    }

    return null
  }

  const handleFile = (file: File | null) => {
    if (!file) {
      setSelectedFile(null)
      setValidationError(null)
      onFileSelect?.(null)
      return
    }

    const err = validateFile(file)
    if (err) {
      setValidationError(err)
      setSelectedFile(null)
      onFileSelect?.(null)
      if (inputRef.current) inputRef.current.value = ''
      return
    }

    setValidationError(null)
    setSelectedFile(file)
    onFileSelect?.(file)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    if (disabled || isUploading) return

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (!disabled && !isUploading) {
      setIsDragOver(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleClear = () => {
    handleFile(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleUploadClick = async () => {
    if (!selectedFile || !onUpload || isUploading) return
    try {
      await onUpload(selectedFile)
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Upload failed.')
    }
  }

  return (
    <div className={cn('w-full space-y-2', className)}>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        disabled={disabled || isUploading}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleFile(e.target.files[0])
          }
        }}
        className="sr-only"
        aria-describedby={activeError ? `${id}-error` : undefined}
      />

      {!selectedFile ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => !disabled && !isUploading && inputRef.current?.click()}
          role="button"
          tabIndex={disabled ? -1 : 0}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !disabled && !isUploading) {
              e.preventDefault()
              inputRef.current?.click()
            }
          }}
          className={cn(
            'flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl transition-colors cursor-pointer text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
            isDragOver
              ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20'
              : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-900',
            disabled && 'opacity-50 cursor-not-allowed',
            activeError && 'border-red-500 bg-red-50/20 dark:bg-red-950/10'
          )}
        >
          <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-2.5 text-slate-500 dark:text-slate-400">
            <UploadCloud className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{label}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
          <span className="text-[11px] text-slate-400 mt-2">
            Max size: {formatBytes(maxSizeBytes)}
            {allowedExtensions && ` • Supported: ${allowedExtensions.join(', ')}`}
          </span>
        </div>
      ) : (
        <div className="flex flex-col p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 truncate">
              <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <FileIcon className="h-4 w-4" />
              </div>
              <div className="truncate">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-slate-500">{formatBytes(selectedFile.size)}</p>
              </div>
            </div>

            {!isUploading && (
              <button
                type="button"
                onClick={handleClear}
                aria-label="Remove selected file"
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Real upload progress bar if available */}
          {uploadProgress !== undefined && uploadProgress >= 0 && (
            <div className="w-full space-y-1">
              <div className="flex justify-between text-xs text-slate-500">
                <span>Uploading...</span>
                <span>{Math.round(uploadProgress)}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, uploadProgress))}%` }}
                />
              </div>
            </div>
          )}

          {onUpload && (
            <Button
              size="sm"
              isLoading={isUploading}
              disabled={disabled || isUploading}
              onClick={handleUploadClick}
              className="w-full"
            >
              Upload File
            </Button>
          )}
        </div>
      )}

      {activeError && (
        <div
          id={`${id}-error`}
          role="alert"
          className="flex items-center space-x-1.5 text-xs text-red-600 dark:text-red-400 mt-1"
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{activeError}</span>
        </div>
      )}
    </div>
  )
}
