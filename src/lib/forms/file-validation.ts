/**
 * File validation and safety checks including size, extension, MIME, and binary magic-bytes inspection.
 */

import type { FileValidationOptions, FileValidationResult } from './types'

// Known magic byte signatures for common secure web file types
const MAGIC_SIGNATURES: Record<string, { bytes: number[]; offset?: number }> = {
  'image/jpeg': { bytes: [0xff, 0xd8, 0xff] },
  'image/png': { bytes: [0x89, 0x50, 0x4e, 0x47] },
  'image/gif': { bytes: [0x47, 0x49, 0x46, 0x38] },
  'application/pdf': { bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
}

/**
 * Checks if a byte slice matches expected signature bytes.
 */
function matchesSignature(buffer: Uint8Array, expected: number[], offset = 0): boolean {
  if (buffer.length < offset + expected.length) return false
  for (let i = 0; i < expected.length; i++) {
    if (buffer[offset + i] !== expected[i]) {
      return false
    }
  }
  return true
}

/**
 * Inspects a File's binary header to verify actual file format, protecting against extension spoofing.
 */
export async function detectMagicType(file: File): Promise<string | undefined> {
  if (!file || typeof file.slice !== 'function') return undefined

  try {
    const slice = file.slice(0, 16)
    const arrayBuffer = await slice.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)

    for (const [mime, sig] of Object.entries(MAGIC_SIGNATURES)) {
      if (matchesSignature(bytes, sig.bytes, sig.offset || 0)) {
        return mime
      }
    }

    // Check for RIFF WebP: 'RIFF' at 0, 'WEBP' at 8
    if (
      matchesSignature(bytes, [0x52, 0x49, 0x46, 0x46], 0) &&
      matchesSignature(bytes, [0x57, 0x45, 0x42, 0x50], 8)
    ) {
      return 'image/webp'
    }

    return undefined
  } catch {
    return undefined
  }
}

/**
 * Validates a selected File against size limits, extension whitelists, MIME whitelists, and optional magic bytes.
 */
export async function validateFileSafety(
  file: File,
  options: FileValidationOptions = {}
): Promise<FileValidationResult> {
  if (!file) {
    return { isValid: false, error: 'No file provided.' }
  }

  // 1. File size check
  if (options.maxSizeBytes !== undefined && file.size > options.maxSizeBytes) {
    const maxMb = (options.maxSizeBytes / (1024 * 1024)).toFixed(1)
    return {
      isValid: false,
      error: `File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds maximum limit of ${maxMb}MB.`,
    }
  }

  // 2. Extension check
  const fileName = file.name || ''
  const dotIndex = fileName.lastIndexOf('.')
  const ext = dotIndex !== -1 ? fileName.slice(dotIndex).toLowerCase() : ''

  if (options.allowedExtensions && options.allowedExtensions.length > 0) {
    const normalizedWhiltelist = options.allowedExtensions.map((e) =>
      e.startsWith('.') ? e.toLowerCase() : `.${e.toLowerCase()}`
    )

    if (!ext || !normalizedWhiltelist.includes(ext)) {
      return {
        isValid: false,
        error: `File extension "${ext || 'none'}" is not permitted. Allowed: ${normalizedWhiltelist.join(', ')}`,
      }
    }
  }

  // 3. Browser-reported MIME check
  if (options.allowedMimeTypes && options.allowedMimeTypes.length > 0) {
    if (!file.type || !options.allowedMimeTypes.includes(file.type)) {
      return {
        isValid: false,
        error: `File MIME type "${file.type || 'unknown'}" is not supported.`,
      }
    }
  }

  // 4. Binary header / Magic bytes inspection
  if (options.verifyMagicBytes) {
    const detected = await detectMagicType(file)
    // If client claimed image/png, image/jpeg, or application/pdf, require binary signature match
    if (file.type && file.type in MAGIC_SIGNATURES) {
      if (detected !== file.type) {
        return {
          isValid: false,
          error: `File content header does not match declared type "${file.type}". Possible extension spoofing.`,
          detectedType: detected,
        }
      }
    }
    return { isValid: true, detectedType: detected }
  }

  return { isValid: true }
}
