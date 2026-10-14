/**
 * Storage Security, Path Sanitization & Access Control
 * 
 * Prevents:
 * - Directory traversal attacks (../, ..\, null bytes)
 * - Arbitrary file execution & dangerous script extensions
 * - Unauthorized access to private files
 */

import { randomBytes } from 'node:crypto'
import { sanitizeFileName } from '../security/sanitize'
import { DANGEROUS_EXTENSIONS } from '../security/upload'
import type { StoredFileMetadata } from './types'

/**
 * Validates and sanitizes a storage path against directory traversal.
 */
export function sanitizeStoragePath(path: string): { valid: boolean; path?: string; error?: string } {
  if (!path || typeof path !== 'string') {
    return { valid: false, error: 'Storage path is required' }
  }

  // 1. Reject null bytes and non-printable characters
  if (path.includes('\0') || /[\x00-\x1F\x7F]/.test(path)) {
    return { valid: false, error: 'Storage path contains illegal control characters' }
  }

  // 2. Reject directory traversal indicators
  if (path.includes('..') || path.includes('\\')) {
    return { valid: false, error: 'Path traversal sequences (".." or "\\") are prohibited' }
  }

  // 3. Reject Windows drive letters and UNC paths
  if (/^[a-zA-Z]:/.test(path) || path.startsWith('//')) {
    return { valid: false, error: 'Absolute drive and UNC paths are prohibited' }
  }

  // 4. Normalize slashes and remove leading/trailing slashes
  const segments = path
    .split('/')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s !== '.')

  if (segments.length === 0) {
    return { valid: false, error: 'Path must contain at least one valid segment' }
  }

  // Check each segment
  for (const seg of segments) {
    if (seg === '..' || seg === '.') {
      return { valid: false, error: 'Directory traversal segment detected' }
    }
  }

  return { valid: true, path: segments.join('/') }
}

/**
 * Generates a collision-resistant safe storage path.
 * Format: [prefix]/[timestamp]_[random8]_[sanitizedFilename]
 */
export function generateSafeStoragePath(filename: string, prefix?: string): string {
  const safeName = sanitizeFileName(filename)
  const randomSuffix = randomBytes(4).toString('hex')
  const timestamp = Date.now()

  const uniqueFile = `${timestamp}_${randomSuffix}_${safeName}`
  if (!prefix) return uniqueFile

  const cleanPrefix = prefix.replace(/^\/+|\/+$/g, '').replace(/[^a-zA-Z0-9_-]/g, '')
  return cleanPrefix ? `${cleanPrefix}/${uniqueFile}` : uniqueFile
}

/**
 * Validates upload file size and MIME type.
 */
export function validateStorageFile(
  filename: string,
  sizeBytes: number,
  mimeType: string,
  options: { maxSizeInBytes?: number; allowedMimeTypes?: string[] } = {}
): { valid: boolean; error?: string } {
  const maxSize = options.maxSizeInBytes ?? 10 * 1024 * 1024 // 10MB default
  const allowedTypes = options.allowedMimeTypes

  if (sizeBytes <= 0) {
    return { valid: false, error: 'File cannot be empty' }
  }

  if (sizeBytes > maxSize) {
    return { valid: false, error: `File size (${sizeBytes} bytes) exceeds limit of ${maxSize} bytes` }
  }

  const ext = filename.split('.').pop()?.toLowerCase() || ''
  if (DANGEROUS_EXTENSIONS.has(ext)) {
    return { valid: false, error: `Executable or script extension ".${ext}" is not permitted` }
  }

  if (allowedTypes && allowedTypes.length > 0) {
    const isAllowed = allowedTypes.some((t) => mimeType.toLowerCase().startsWith(t.toLowerCase()))
    if (!isAllowed) {
      return { valid: false, error: `MIME type "${mimeType}" is not permitted` }
    }
  }

  return { valid: true }
}

/**
 * Verifies authorization to access a stored file.
 * Public files can be accessed by anyone.
 * Private files require ownership match or admin role.
 */
export function verifyStorageAccess(
  file: StoredFileMetadata,
  requestingUserId?: string,
  userRole?: string
): boolean {
  if (file.isPublic) return true
  if (userRole === 'admin') return true
  if (requestingUserId && file.ownerId === requestingUserId) return true
  return false
}
