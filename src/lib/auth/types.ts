/**
 * Reusable Authentication & Authorization Toolkit Types
 * 
 * Inspired by Better Auth, Auth.js, Lucia, and CASL
 */

export interface AuthUser {
  id: string
  email: string
  name?: string
  role: string
  permissions?: string[]
  metadata?: Record<string, unknown>
  createdAt?: string
  updatedAt?: string
}

export interface AuthSession {
  id: string
  userId: string
  token: string
  expiresAt: Date | string
  createdAt: Date | string
  fresh?: boolean
  user?: AuthUser
}

export type AuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'USER_NOT_FOUND'
  | 'USER_EXISTS'
  | 'SESSION_EXPIRED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'RATE_LIMITED'
  | 'WEAK_PASSWORD'
  | 'INVALID_TOKEN'
  | 'NOT_CONFIGURED'
  | 'INVALID_OAUTH_STATE'

export interface AuthResult {
  success: boolean
  user?: AuthUser
  session?: AuthSession
  error?: string
  errorCode?: AuthErrorCode
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterCredentials {
  email: string
  password: string
  name?: string
  role?: string
}

// ---------------------------------------------------------------------------
// Authorization & CASL-style Ability Types
// ---------------------------------------------------------------------------

export type AuthAction = 'create' | 'read' | 'update' | 'delete' | 'manage' | string

export type AuthSubject = 'all' | 'User' | 'Project' | 'Document' | 'Settings' | string

export interface AbilityRule<TContext = unknown> {
  action: AuthAction | AuthAction[]
  subject: AuthSubject | AuthSubject[]
  conditions?: (context: TContext) => boolean
  inverted?: boolean
}

export interface RoleDefinition {
  name: string
  inherits?: string[]
  rules: AbilityRule<unknown>[]
}

export interface IAbility {
  can(action: AuthAction, subject: AuthSubject, context?: unknown): boolean
  cannot(action: AuthAction, subject: AuthSubject, context?: unknown): boolean
  rules: AbilityRule<unknown>[]
}

// ---------------------------------------------------------------------------
// OAuth Contract Types
// ---------------------------------------------------------------------------

export type OAuthProviderName = 'github' | 'google' | 'mock'

export interface OAuthCallbackPayload {
  code: string
  state: string
  expectedState?: string
}

export interface OAuthProfile {
  provider: OAuthProviderName
  providerUserId: string
  email: string
  name?: string
  avatarUrl?: string
}
