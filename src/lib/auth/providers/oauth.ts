/**
 * Modular OAuth 2.0 & PKCE State Validation Helper
 * 
 * Provides:
 * - CSRF state token generation and verification
 * - PKCE code challenge generation (S256)
 * - Safe callback validation without exposing secrets
 */

import { randomBytes, createHash } from 'node:crypto'
import type { OAuthProviderName, OAuthProfile, OAuthCallbackPayload } from '../types'

export interface OAuthStateRecord {
  state: string
  provider: OAuthProviderName
  codeVerifier?: string
  redirectUri: string
  createdAt: number
}

// In-memory state store for CSRF verification (TTL: 10 minutes)
const oauthStateStore = new Map<string, OAuthStateRecord>()

export function generateOAuthState(provider: OAuthProviderName, redirectUri: string): {
  state: string
  codeVerifier: string
  codeChallenge: string
} {
  const state = randomBytes(24).toString('hex')
  const codeVerifier = randomBytes(32).toString('base64url')
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')

  oauthStateStore.set(state, {
    state,
    provider,
    codeVerifier,
    redirectUri,
    createdAt: Date.now(),
  })

  return { state, codeVerifier, codeChallenge }
}

export function validateOAuthCallbackState(payload: OAuthCallbackPayload): {
  valid: boolean
  error?: string
  record?: OAuthStateRecord
} {
  if (!payload.state || typeof payload.state !== 'string') {
    return { valid: false, error: 'OAuth state parameter is missing' }
  }

  // Check expected state if provided directly
  if (payload.expectedState && payload.state !== payload.expectedState) {
    return { valid: false, error: 'OAuth state mismatch: potential CSRF attack detected' }
  }

  const record = oauthStateStore.get(payload.state)
  if (!record) {
    return { valid: false, error: 'Invalid or expired OAuth state' }
  }

  // Enforce 10-minute expiry
  if (Date.now() - record.createdAt > 10 * 60 * 1000) {
    oauthStateStore.delete(payload.state)
    return { valid: false, error: 'OAuth authorization request has expired' }
  }

  // One-time use: delete after validation
  oauthStateStore.delete(payload.state)
  return { valid: true, record }
}

export function mockExchangeOAuthCode(code: string, provider: OAuthProviderName): OAuthProfile {
  return {
    provider,
    providerUserId: `oauth_${provider}_12345`,
    email: `oauth_user_${provider}@example.com`,
    name: `${provider.toUpperCase()} Developer`,
    avatarUrl: `https://avatars.example.com/${provider}.png`,
  }
}
