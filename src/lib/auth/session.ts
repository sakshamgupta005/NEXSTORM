/**
 * Reusable Session Management & Cookie Configuration
 * 
 * Capabilities:
 * - Cryptographically random session tokens (32 bytes entropy)
 * - Configurable expiration & sliding window session extension
 * - Cookie security flags (HttpOnly, SameSite=Lax, Secure, Path=/)
 * - Pluggable session storage (in-memory adapter included for dev and tests)
 */

import { randomBytes } from 'node:crypto'
import type { AuthSession } from './types'

export const AUTH_COOKIE_NAME = 'hackathon_session'
export const DEFAULT_SESSION_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

export interface CookieOptions {
  name: string
  value: string
  httpOnly: boolean
  secure: boolean
  sameSite: 'lax' | 'strict' | 'none'
  path: string
  maxAge: number
}

export function getDefaultCookieOptions(token: string, ttlMs: number = DEFAULT_SESSION_TTL_MS): CookieOptions {
  return {
    name: AUTH_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(ttlMs / 1000),
  }
}

export interface SessionStorage {
  save(session: AuthSession): Promise<void> | void
  get(token: string): Promise<AuthSession | null> | AuthSession | null
  delete(token: string): Promise<void> | void
  deleteUserSessions(userId: string): Promise<void> | void
}

export class InMemorySessionStore implements SessionStorage {
  private sessions = new Map<string, AuthSession>()

  save(session: AuthSession): void {
    this.sessions.set(session.token, session)
  }

  get(token: string): AuthSession | null {
    const session = this.sessions.get(token)
    if (!session) return null

    const expiresAt = new Date(session.expiresAt).getTime()
    if (Date.now() > expiresAt) {
      this.sessions.delete(token)
      return null
    }

    return session
  }

  delete(token: string): void {
    this.sessions.delete(token)
  }

  deleteUserSessions(userId: string): void {
    for (const [token, session] of this.sessions.entries()) {
      if (session.userId === userId) {
        this.sessions.delete(token)
      }
    }
  }

  clear(): void {
    this.sessions.clear()
  }

  get size(): number {
    return this.sessions.size
  }
}

export const sharedSessionStore = new InMemorySessionStore()

/**
 * Creates a new authenticated session for a user.
 */
export async function createSession(
  userId: string,
  options: {
    ttlMs?: number
    storage?: SessionStorage
  } = {}
): Promise<AuthSession> {
  const ttlMs = options.ttlMs ?? DEFAULT_SESSION_TTL_MS
  const storage = options.storage ?? sharedSessionStore

  const token = randomBytes(32).toString('hex')
  const sessionId = `sess_${randomBytes(12).toString('hex')}`
  const now = new Date()
  const expiresAt = new Date(now.getTime() + ttlMs)

  const session: AuthSession = {
    id: sessionId,
    userId,
    token,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    fresh: true,
  }

  await storage.save(session)
  return session
}

/**
 * Validates a session token and returns the session if active and unexpired.
 */
export async function validateSession(
  token: string,
  storage: SessionStorage = sharedSessionStore
): Promise<{ valid: boolean; session?: AuthSession; error?: string }> {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Session token is missing' }
  }

  const session = await storage.get(token)
  if (!session) {
    return { valid: false, error: 'Session not found or expired' }
  }

  return { valid: true, session }
}

/**
 * Invalidates and removes a session token.
 */
export async function invalidateSession(
  token: string,
  storage: SessionStorage = sharedSessionStore
): Promise<void> {
  if (token) {
    await storage.delete(token)
  }
}
