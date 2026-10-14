/**
 * Established Password Hashing & Complexity Validation
 * 
 * Uses Node.js crypto.scrypt with cryptographically random salts
 * and timingSafeEqual to prevent timing side-channel attacks.
 * No custom or unproven crypto algorithms.
 */

import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt)

const KEY_LENGTH = 64
const SALT_LENGTH = 16

/**
 * Validates password strength without overly restrictive arbitrary rules.
 * Requires at least 8 characters with a mix of letters and numbers.
 */
export function validatePasswordStrength(password: string): { valid: boolean; error?: string } {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required' }
  }

  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long' }
  }

  if (password.length > 128) {
    return { valid: false, error: 'Password cannot exceed 128 characters' }
  }

  const hasLetter = /[a-zA-Z]/.test(password)
  const hasNumber = /[0-9]/.test(password)

  if (!hasLetter || !hasNumber) {
    return { valid: false, error: 'Password must contain both letters and numbers' }
  }

  return { valid: true }
}

/**
 * Hashes a plaintext password using standard scrypt with a random 16-byte salt.
 * Output format: scrypt$<saltHex>$<hashHex>
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH).toString('hex')
  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer
  return `scrypt$${salt}$${derivedKey.toString('hex')}`
}

/**
 * Verifies a plaintext password against a stored scrypt hash using timing-safe comparison.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (!password || !storedHash || typeof storedHash !== 'string') {
    return false
  }

  const parts = storedHash.split('$')
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return false
  }

  const [, salt, originalHashHex] = parts
  const originalKeyBuffer = Buffer.from(originalHashHex, 'hex')

  try {
    const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer
    if (derivedKey.length !== originalKeyBuffer.length) {
      return false
    }

    return timingSafeEqual(derivedKey, originalKeyBuffer)
  } catch {
    return false
  }
}
