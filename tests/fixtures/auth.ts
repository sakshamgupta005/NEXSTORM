/**
 * Reusable Auth Test Fixtures & Mocks
 * 
 * Provides deterministic user, session, and Supabase client mocks for unit and integration tests.
 */

import type { User, Session } from '@supabase/supabase-js'

export function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user_mock_12345',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { name: 'Hackathon Contender' },
    aud: 'authenticated',
    confirmation_sent_at: '2026-01-01T00:00:00.000Z',
    recovery_sent_at: undefined,
    email_change_sent_at: undefined,
    new_email: undefined,
    invited_at: undefined,
    action_link: undefined,
    email: 'hacker@example.com',
    phone: '',
    created_at: '2026-01-01T00:00:00.000Z',
    confirmed_at: '2026-01-01T00:00:00.000Z',
    email_confirmed_at: '2026-01-01T00:00:00.000Z',
    phone_confirmed_at: undefined,
    last_sign_in_at: '2026-01-01T00:00:00.000Z',
    role: 'authenticated',
    updated_at: '2026-01-01T00:00:00.000Z',
    identities: [],
    is_anonymous: false,
    factors: [],
    ...overrides,
  }
}

export function createMockSession(overrides: Partial<Session> = {}): Session {
  const user = overrides.user || createMockUser()
  return {
    access_token: 'mock.access.jwt.token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'mock_refresh_token_xyz',
    user,
    ...overrides,
  }
}
