import { describe, it, expect, beforeEach } from 'vitest'
import {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
  createSession,
  validateSession,
  invalidateSession,
  sharedSessionStore,
  getDefaultCookieOptions,
  sharedMockAuthProvider,
  defineAbilityFor,
  requireRole,
  requirePermission,
  generateOAuthState,
  validateOAuthCallbackState,
  Ability,
} from '@/lib/auth'

describe('Authentication & Authorization Toolkit — Unit Tests', () => {
  beforeEach(() => {
    sharedSessionStore.clear()
    sharedMockAuthProvider.clear()
  })

  describe('Password Hashing & Strength Validation', () => {
    it('validates password complexity (length, letters, numbers)', () => {
      expect(validatePasswordStrength('short').valid).toBe(false)
      expect(validatePasswordStrength('alllettersonly').valid).toBe(false)
      expect(validatePasswordStrength('1234567890').valid).toBe(false)
      expect(validatePasswordStrength('ValidPass123').valid).toBe(true)
    })

    it('hashes passwords using scrypt and verifies with timingSafeEqual', async () => {
      const password = 'StrongPassword2026'
      const hash = await hashPassword(password)

      expect(hash).toMatch(/^scrypt\$[a-f0-9]+\$[a-f0-9]+$/)

      const isValid = await verifyPassword(password, hash)
      expect(isValid).toBe(true)

      const isInvalid = await verifyPassword('WrongPassword123', hash)
      expect(isInvalid).toBe(false)
    })

    it('handles malformed hashes safely without throwing unhandled exceptions', async () => {
      expect(await verifyPassword('test', 'not-a-hash')).toBe(false)
      expect(await verifyPassword('test', 'scrypt$invalid')).toBe(false)
      expect(await verifyPassword('test', '')).toBe(false)
    })
  })

  describe('Session Management & Lifecycle', () => {
    it('creates, retrieves, and validates active sessions', async () => {
      const session = await createSession('usr_test_1', { ttlMs: 60000 })
      expect(session.id).toMatch(/^sess_/)
      expect(session.token).toHaveLength(64)
      expect(session.userId).toBe('usr_test_1')

      const validation = await validateSession(session.token)
      expect(validation.valid).toBe(true)
      expect(validation.session?.userId).toBe('usr_test_1')
    })

    it('expires sessions after configured TTL', async () => {
      // 10ms session
      const session = await createSession('usr_expiring', { ttlMs: 10 })
      await new Promise((resolve) => setTimeout(resolve, 25))

      const validation = await validateSession(session.token)
      expect(validation.valid).toBe(false)
      expect(validation.error).toContain('expired')
    })

    it('invalidates sessions explicitly on logout', async () => {
      const session = await createSession('usr_logout')
      await invalidateSession(session.token)

      const validation = await validateSession(session.token)
      expect(validation.valid).toBe(false)
    })

    it('generates secure production-ready cookie configurations', () => {
      const cookie = getDefaultCookieOptions('test_token_123', 3600000)
      expect(cookie.name).toBe('hackathon_session')
      expect(cookie.value).toBe('test_token_123')
      expect(cookie.httpOnly).toBe(true)
      expect(cookie.sameSite).toBe('lax')
      expect(cookie.path).toBe('/')
      expect(cookie.maxAge).toBe(3600)
    })
  })

  describe('Mock Auth Provider Workflows', () => {
    it('logs in pre-seeded accounts successfully', async () => {
      const res = await sharedMockAuthProvider.login({
        email: 'admin@example.com',
        password: 'Password123',
      })

      expect(res.success).toBe(true)
      expect(res.user?.role).toBe('admin')
      expect(res.session?.token).toBeDefined()
    })

    it('rejects invalid credentials with generic safe error', async () => {
      const res = await sharedMockAuthProvider.login({
        email: 'admin@example.com',
        password: 'WrongPassword',
      })

      expect(res.success).toBe(false)
      expect(res.errorCode).toBe('INVALID_CREDENTIALS')
      expect(res.error).toBe('Invalid email or password')
    })

    it('registers new accounts with scrypt hashing and checks duplicates', async () => {
      const registerRes = await sharedMockAuthProvider.register({
        email: 'newuser@hackathon.test',
        password: 'SecurePassword123',
        name: 'New Participant',
      })

      expect(registerRes.success).toBe(true)
      expect(registerRes.user?.email).toBe('newuser@hackathon.test')
      expect(registerRes.user?.name).toBe('New Participant')

      // Reject duplicate
      const duplicateRes = await sharedMockAuthProvider.register({
        email: 'newuser@hackathon.test',
        password: 'SecurePassword123',
      })
      expect(duplicateRes.success).toBe(false)
      expect(duplicateRes.errorCode).toBe('USER_EXISTS')

      // Login with newly registered credentials
      const loginRes = await sharedMockAuthProvider.login({
        email: 'newuser@hackathon.test',
        password: 'SecurePassword123',
      })
      expect(loginRes.success).toBe(true)
      expect(loginRes.user?.id).toBe(registerRes.user?.id)
    })
  })

  describe('CASL-Style Authorization & Abilities', () => {
    it('grants full management privileges to admin role', () => {
      const adminUser = { id: 'usr_admin', email: 'admin@test.com', role: 'admin' }
      const ability = defineAbilityFor(adminUser)

      expect(ability.can('manage', 'all')).toBe(true)
      expect(ability.can('delete', 'Project')).toBe(true)
      expect(ability.can('update', 'Settings')).toBe(true)
      expect(ability.cannot('create', 'User')).toBe(false)
    })

    it('enforces inverted rule for editor role (cannot delete)', () => {
      const editorUser = { id: 'usr_editor', email: 'editor@test.com', role: 'editor' }
      const ability = defineAbilityFor(editorUser)

      expect(ability.can('read', 'all')).toBe(true)
      expect(ability.can('create', 'Project')).toBe(true)
      expect(ability.can('update', 'Document')).toBe(true)
      expect(ability.can('delete', 'Project')).toBe(false)
      expect(ability.cannot('delete', 'all')).toBe(true)
    })

    it('enforces ABAC conditions based on resource ownership for regular users', () => {
      const user = { id: 'usr_alice', email: 'alice@test.com', role: 'user' }
      const ability = defineAbilityFor(user)

      const ownProject = { id: 'proj_1', ownerId: 'usr_alice', title: "Alice's Project" }
      const otherProject = { id: 'proj_2', ownerId: 'usr_bob', title: "Bob's Project" }

      expect(ability.can('read', 'Project')).toBe(true)
      expect(ability.can('create', 'Project')).toBe(true)
      expect(ability.can('update', 'Project', ownProject)).toBe(true)
      expect(ability.can('update', 'Project', otherProject)).toBe(false)
      expect(ability.can('delete', 'Project', ownProject)).toBe(true)
      expect(ability.can('delete', 'Project', otherProject)).toBe(false)
    })

    it('restricts unauthenticated guests to read-only access', () => {
      const ability = defineAbilityFor(null)
      expect(ability.can('read', 'Project')).toBe(true)
      expect(ability.can('create', 'Project')).toBe(false)
      expect(ability.can('update', 'Project')).toBe(false)
      expect(ability.can('delete', 'Project')).toBe(false)
    })

    it('supports custom programmatic Ability rules', () => {
      const customAbility = new Ability([
        {
          action: 'export',
          subject: 'Document',
          conditions: (ctx: unknown) => Boolean(ctx && typeof ctx === 'object' && (ctx as { isPublic?: boolean }).isPublic),
        },
      ])

      expect(customAbility.can('export', 'Document', { isPublic: true })).toBe(true)
      expect(customAbility.can('export', 'Document', { isPublic: false })).toBe(false)
    })
  })

  describe('Server-Side Security Guards', () => {
    it('enforces role checks and emits 401/403 responses', () => {
      const regularUser = { id: 'usr_bob', email: 'bob@test.com', role: 'user' }

      const adminCheck = requireRole(regularUser, 'admin')
      expect(adminCheck.allowed).toBe(false)
      expect(adminCheck.error?.status).toBe(403)
      expect(adminCheck.error?.code).toBe('FORBIDDEN')

      const userCheck = requireRole(regularUser, ['user', 'editor'])
      expect(userCheck.allowed).toBe(true)

      const guestCheck = requireRole(null, 'user')
      expect(guestCheck.allowed).toBe(false)
      expect(guestCheck.error?.status).toBe(401)
      expect(guestCheck.error?.code).toBe('UNAUTHORIZED')
    })

    it('enforces permission checks with requirePermission', () => {
      const user = { id: 'usr_charlie', email: 'charlie@test.com', role: 'user' }
      const ability = defineAbilityFor(user)

      const canCreate = requirePermission(ability, 'create', 'Project')
      expect(canCreate.allowed).toBe(true)

      const cannotDeleteOther = requirePermission(ability, 'delete', 'Project', { ownerId: 'someone_else' })
      expect(cannotDeleteOther.allowed).toBe(false)
      expect(cannotDeleteOther.error?.status).toBe(403)
    })
  })

  describe('OAuth & PKCE CSRF Validation', () => {
    it('generates cryptographically secure state and PKCE challenges', () => {
      const { state, codeVerifier, codeChallenge } = generateOAuthState('github', 'http://localhost:3000/callback')
      expect(state).toHaveLength(48)
      expect(codeVerifier).toBeDefined()
      expect(codeChallenge).toBeDefined()

      // Valid state verification
      const validCheck = validateOAuthCallbackState({ code: 'gh_code_123', state })
      expect(validCheck.valid).toBe(true)
      expect(validCheck.record?.provider).toBe('github')

      // Second attempt fails (one-time use CSRF token)
      const replayCheck = validateOAuthCallbackState({ code: 'gh_code_123', state })
      expect(replayCheck.valid).toBe(false)
      expect(replayCheck.error).toContain('Invalid or expired')
    })

    it('rejects state parameter tampering', () => {
      generateOAuthState('google', 'http://localhost:3000/callback')
      const invalidCheck = validateOAuthCallbackState({
        code: 'google_code_123',
        state: 'tampered_state_token',
      })
      expect(invalidCheck.valid).toBe(false)
    })
  })
})
