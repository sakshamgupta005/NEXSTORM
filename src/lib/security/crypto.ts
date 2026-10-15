/**
 * src/lib/security/crypto.ts
 * Constant-time comparison and cryptographic helper functions for secure token verification.
 */

import { timingSafeEqual } from 'node:crypto'

/**
 * Constant-time string comparison to prevent timing side-channel attacks on secrets and bearer tokens.
 */
export function timingSafeCompare(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}
