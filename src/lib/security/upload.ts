/**
 * File Upload Security & Validation Utilities
 * 
 * Capabilities:
 * - Size limit enforcement
 * - MIME type whitelisting
 * - Dangerous executable & script extension rejection
 * - Sanitized safe filename generation
 */

import { sanitizeFileName } from './sanitize'

export interface FileValidationOptions {
  maxSizeInBytes?: number
  allowedMimeTypes?: string[]
  disallowedExtensions?: string[]
}

export interface FileValidationResult {
  valid: boolean
  error?: string
  sanitizedName: string
}

export const DEFAULT_ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/json',
]

export const DANGEROUS_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'sh', 'php', 'phtml', 'py', 'pl', 'jsp', 'asp', 'aspx',
  'js', 'mjs', 'cjs', 'ts', 'vbs', 'scr', 'dll', 'so', 'jar', 'svg', 'html', 'htm',
])

export function validateUploadFile(
  file: { name: string; size: number; type: string },
  options: FileValidationOptions = {}
): FileValidationResult {
  const {
    maxSizeInBytes = 5 * 1024 * 1024, // 5MB default
    allowedMimeTypes = DEFAULT_ALLOWED_MIME_TYPES,
    disallowedExtensions,
  } = options

  const sanitizedName = sanitizeFileName(file.name)

  if (!file || typeof file.size !== 'number' || !file.name) {
    return {
      valid: false,
      error: 'Invalid file payload.',
      sanitizedName,
    }
  }

  // 1. Check file size
  if (file.size <= 0) {
    return {
      valid: false,
      error: 'File is empty.',
      sanitizedName,
    }
  }

  if (file.size > maxSizeInBytes) {
    const maxMb = (maxSizeInBytes / (1024 * 1024)).toFixed(1)
    return {
      valid: false,
      error: `File exceeds maximum allowed size of ${maxMb}MB.`,
      sanitizedName,
    }
  }

  // 2. Check extension
  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  const blockedExtensions = disallowedExtensions ? new Set(disallowedExtensions) : DANGEROUS_EXTENSIONS

  if (blockedExtensions.has(ext)) {
    return {
      valid: false,
      error: `File type '.${ext}' is prohibited for security reasons.`,
      sanitizedName,
    }
  }

  // 3. Check MIME type
  if (allowedMimeTypes.length > 0 && !allowedMimeTypes.includes(file.type.toLowerCase())) {
    return {
      valid: false,
      error: `MIME type '${file.type}' is not supported.`,
      sanitizedName,
    }
  }

  return {
    valid: true,
    sanitizedName,
  }
}
