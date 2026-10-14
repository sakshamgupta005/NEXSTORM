/**
 * Input & Output Sanitization Utilities
 * 
 * Capabilities:
 * - HTML escaping to prevent XSS in rendered text
 * - Path traversal prevention for file uploads and dynamic keys
 * - Control character stripping for prompt injection / terminal injection
 */

/**
 * Escapes unsafe HTML characters to prevent XSS.
 */
export function escapeHtml(unsafe: string): string {
  if (!unsafe || typeof unsafe !== 'string') return ''
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Strips HTML tags completely from a string.
 */
export function stripHtmlTags(input: string): string {
  if (!input || typeof input !== 'string') return ''
  return input.replace(/<[^>]*>/g, '').trim()
}

/**
 * Sanitizes a filename to prevent path traversal and null-byte injection.
 * Removes `..`, `/`, `\`, null bytes, and non-ASCII or unsafe characters.
 */
export function sanitizeFileName(fileName: string): string {
  if (!fileName || typeof fileName !== 'string') return 'file'
  
  // Extract basename if path was provided
  const baseName = fileName.split(/[/\\]/).pop() || 'file'

  // Remove null bytes and non-printable control characters
  let clean = baseName.replace(/[\x00-\x1F\x7F]/g, '')

  // Remove path traversal sequences
  clean = clean.replace(/\.{2,}/g, '.')

  // Replace unsafe file characters with hyphens
  clean = clean.replace(/[^a-zA-Z0-9._-]/g, '_')

  // Prevent dotfile or empty name
  if (clean.startsWith('.')) {
    clean = `file_${clean.slice(1)}`
  }

  return clean.slice(0, 100) || 'file'
}

/**
 * Strips dangerous non-printable ASCII control characters.
 */
export function sanitizePlainText(text: string): string {
  if (!text || typeof text !== 'string') return ''
  // Strip ASCII 0-8, 11-12, 14-31, 127
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
}
