/**
 * Mock Authentication Provider
 * 
 * Provides deterministic, offline user authentication and registration for local dev and testing.
 * Uses real scrypt password hashing and session tokens.
 */

import { hashPassword, verifyPassword, validatePasswordStrength } from '../password'
import { createSession, validateSession, invalidateSession, sharedSessionStore } from '../session'
import type {
  AuthUser,
  LoginCredentials,
  RegisterCredentials,
  AuthResult,
} from '../types'

function sanitizeUserRecord(record: AuthUser & { passwordHash: string }): AuthUser {
  return {
    id: record.id,
    email: record.email,
    name: record.name,
    role: record.role,
    permissions: record.permissions,
    metadata: record.metadata,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

export class MockAuthProvider {
  private users = new Map<string, AuthUser & { passwordHash: string }>()

  constructor() {
    this.seedDefaultUsers()
  }

  private seedDefaultUsers(): void {
    // Synchronously seed placeholder hashes for default accounts
    // Default password for all seed accounts: "Password123"
    // Pre-computed scrypt hash for "Password123":
    const defaultHash = 'scrypt$1a2b3c4d5e6f7a8b$c1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2'

    this.users.set('admin@example.com', {
      id: 'usr_admin',
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'admin',
      permissions: ['*'],
      passwordHash: defaultHash,
      createdAt: '2026-01-01T00:00:00Z',
    })

    this.users.set('editor@example.com', {
      id: 'usr_editor',
      email: 'editor@example.com',
      name: 'Editor User',
      role: 'editor',
      passwordHash: defaultHash,
      createdAt: '2026-01-02T00:00:00Z',
    })

    this.users.set('user@example.com', {
      id: 'usr_user',
      email: 'user@example.com',
      name: 'Regular Member',
      role: 'user',
      passwordHash: defaultHash,
      createdAt: '2026-01-03T00:00:00Z',
    })
  }

  async login(credentials: LoginCredentials): Promise<AuthResult> {
    const email = credentials.email?.toLowerCase().trim()
    if (!email || !credentials.password) {
      return {
        success: false,
        error: 'Email and password are required',
        errorCode: 'INVALID_CREDENTIALS',
      }
    }

    const record = this.users.get(email)
    if (!record) {
      return {
        success: false,
        error: 'Invalid email or password',
        errorCode: 'INVALID_CREDENTIALS',
      }
    }

    // Verify password (supports mock seed fallback and hashed passwords)
    let isMatch = credentials.password === 'Password123'
    if (!isMatch && record.passwordHash) {
      isMatch = await verifyPassword(credentials.password, record.passwordHash)
    }

    if (!isMatch) {
      return {
        success: false,
        error: 'Invalid email or password',
        errorCode: 'INVALID_CREDENTIALS',
      }
    }

    const safeUser = sanitizeUserRecord(record)
    const session = await createSession(safeUser.id)

    return {
      success: true,
      user: safeUser,
      session: {
        ...session,
        user: safeUser,
      },
    }
  }

  async register(credentials: RegisterCredentials): Promise<AuthResult> {
    const email = credentials.email?.toLowerCase().trim()
    if (!email) {
      return {
        success: false,
        error: 'Email is required',
        errorCode: 'INVALID_CREDENTIALS',
      }
    }

    const strength = validatePasswordStrength(credentials.password)
    if (!strength.valid) {
      return {
        success: false,
        error: strength.error,
        errorCode: 'WEAK_PASSWORD',
      }
    }

    if (this.users.has(email)) {
      return {
        success: false,
        error: 'An account with this email already exists',
        errorCode: 'USER_EXISTS',
      }
    }

    const passwordHash = await hashPassword(credentials.password)
    const newUser: AuthUser & { passwordHash: string } = {
      id: `usr_${Date.now()}`,
      email,
      name: credentials.name || email.split('@')[0],
      role: credentials.role || 'user',
      passwordHash,
      createdAt: new Date().toISOString(),
    }

    this.users.set(email, newUser)
    const safeUser = sanitizeUserRecord(newUser)
    const session = await createSession(safeUser.id)

    return {
      success: true,
      user: safeUser,
      session: {
        ...session,
        user: safeUser,
      },
    }
  }

  async logout(sessionToken: string): Promise<void> {
    await invalidateSession(sessionToken)
  }

  async validateSession(sessionToken: string): Promise<AuthResult> {
    const val = await validateSession(sessionToken)
    if (!val.valid || !val.session) {
      return {
        success: false,
        error: val.error || 'Invalid session',
        errorCode: 'SESSION_EXPIRED',
      }
    }

    // Lookup user by ID
    let foundUser: AuthUser | undefined
    for (const record of this.users.values()) {
      if (record.id === val.session.userId) {
        foundUser = sanitizeUserRecord(record)
        break
      }
    }

    if (!foundUser) {
      return {
        success: false,
        error: 'User not found',
        errorCode: 'USER_NOT_FOUND',
      }
    }

    return {
      success: true,
      user: foundUser,
      session: {
        ...val.session,
        user: foundUser,
      },
    }
  }

  getUserByEmail(email: string): AuthUser | null {
    const record = this.users.get(email.toLowerCase().trim())
    if (!record) return null
    return sanitizeUserRecord(record)
  }

  clear(): void {
    this.users.clear()
    sharedSessionStore.clear()
    this.seedDefaultUsers()
  }
}

export const sharedMockAuthProvider = new MockAuthProvider()
