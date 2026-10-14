/**
 * Safe Redirect URL Validator
 *
 * Prevents Open Redirect vulnerabilities by ensuring that redirect destinations
 * are strictly internal application paths. Rejects external schemes,
 * protocol-relative URLs (//evil.com), backslashes, and control characters.
 */

const DEFAULT_FALLBACK = '/dashboard'

/**
 * Validates whether a given string is a safe internal application path.
 */
export function isSafeRedirectPath(target?: string | null): boolean {
  if (!target || typeof target !== 'string') {
    return false
  }

  // Reject control characters anywhere in raw input
  if (/[\x00-\x1F\x7F]/.test(target)) {
    return false
  }

  const trimmed = target.trim()

  // Must not be empty
  if (trimmed.length === 0) {
    return false
  }

  // Must start with exactly one forward slash
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return false
  }

  // Reject backslashes (some browsers treat /\ or \ as protocol-relative)
  if (trimmed.includes('\\')) {
    return false
  }

  // Reject scheme-like patterns anywhere before a query/hash (e.g., /javascript:alert(1))
  const pathBeforeQuery = trimmed.split('?')[0].split('#')[0]
  if (pathBeforeQuery.includes(':')) {
    return false
  }

  try {
    // Verify using standard URL resolution against a dummy origin
    const resolved = new URL(trimmed, 'http://localhost')
    // Origin must remain strictly the dummy origin
    if (resolved.origin !== 'http://localhost') {
      return false
    }
    // Pathname must still start with '/'
    if (!resolved.pathname.startsWith('/')) {
      return false
    }
  } catch {
    return false
  }

  return true
}

/**
 * Sanitizes a redirect destination, returning the destination if safe,
 * or the fallback if unsafe or missing.
 */
export function getSafeRedirectPath(
  target?: string | null,
  fallback = DEFAULT_FALLBACK
): string {
  if (isSafeRedirectPath(target)) {
    return target!.trim()
  }

  return isSafeRedirectPath(fallback) ? fallback : DEFAULT_FALLBACK
}
