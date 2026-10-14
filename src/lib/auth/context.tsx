'use client'

/**
 * Frontend Authentication State & Declarative Ability Components
 * 
 * Provides:
 * - AuthProvider context
 * - useAuth() hook
 * - useAbility() hook
 * - <Can /> component for conditional UI rendering (CASL-style)
 * - <ProtectedRoute /> component with loading & unauthorized fallback
 */

import React, { createContext, useContext, useState, useMemo } from 'react'
import type {
  AuthUser,
  AuthSession,
  LoginCredentials,
  RegisterCredentials,
  AuthResult,
  AuthAction,
  AuthSubject,
  IAbility,
} from './types'
import { defineAbilityFor } from './authorization'
import { sharedMockAuthProvider } from './providers/mock'

interface AuthContextValue {
  user: AuthUser | null
  session: AuthSession | null
  ability: IAbility
  isLoading: boolean
  isAuthenticated: boolean
  login: (credentials: LoginCredentials) => Promise<AuthResult>
  register: (credentials: RegisterCredentials) => Promise<AuthResult>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export interface AuthProviderProps {
  children: React.ReactNode
  initialUser?: AuthUser | null
  initialSession?: AuthSession | null
}

export function AuthProvider({
  children,
  initialUser = null,
  initialSession = null,
}: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(initialUser)
  const [session, setSession] = useState<AuthSession | null>(initialSession)
  const [isLoading, setIsLoading] = useState<boolean>(false)

  const ability = useMemo(() => defineAbilityFor(user), [user])

  const login = React.useCallback(async (credentials: LoginCredentials): Promise<AuthResult> => {
    setIsLoading(true)
    try {
      const res = await sharedMockAuthProvider.login(credentials)
      if (res.success && res.user && res.session) {
        setUser(res.user)
        setSession(res.session)
      }
      return res
    } finally {
      setIsLoading(false)
    }
  }, [])

  const register = React.useCallback(async (credentials: RegisterCredentials): Promise<AuthResult> => {
    setIsLoading(true)
    try {
      const res = await sharedMockAuthProvider.register(credentials)
      if (res.success && res.user && res.session) {
        setUser(res.user)
        setSession(res.session)
      }
      return res
    } finally {
      setIsLoading(false)
    }
  }, [])

  const logout = React.useCallback(async (): Promise<void> => {
    setIsLoading(true)
    try {
      if (session?.token) {
        await sharedMockAuthProvider.logout(session.token)
      }
      setUser(null)
      setSession(null)
    } finally {
      setIsLoading(false)
    }
  }, [session?.token])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      ability,
      isLoading,
      isAuthenticated: Boolean(user),
      login,
      register,
      logout,
    }),
    [user, session, ability, isLoading, login, register, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an <AuthProvider>')
  }
  return context
}

export function useAbility(): {
  ability: IAbility
  can: (action: AuthAction, subject: AuthSubject, context?: unknown) => boolean
  cannot: (action: AuthAction, subject: AuthSubject, context?: unknown) => boolean
} {
  const { ability } = useAuth()
  return {
    ability,
    can: ability.can.bind(ability),
    cannot: ability.cannot.bind(ability),
  }
}

// ---------------------------------------------------------------------------
// Declarative UI Components
// ---------------------------------------------------------------------------

export interface CanProps {
  I: AuthAction
  an: AuthSubject
  this?: unknown
  children: React.ReactNode
  fallback?: React.ReactNode
}

/**
 * Declarative component for showing/hiding UI based on user permissions.
 *
 * Example:
 * `<Can I="delete" an="Project" this={project} fallback={<DisabledButton />}>`
 *   `<DeleteButton />`
 * `</Can>`
 */
export function Can({ I: action, an: subject, this: context, children, fallback = null }: CanProps) {
  const { ability } = useAuth()
  const allowed = ability.can(action, subject, context)

  if (!allowed) {
    return fallback ? <>{fallback}</> : null
  }

  return <>{children}</>
}

export interface ProtectedRouteProps {
  children: React.ReactNode
  roles?: string[]
  fallback?: React.ReactNode
  loadingFallback?: React.ReactNode
}

/**
 * Client-side protected route wrapper that gates views based on authentication and roles.
 */
export function ProtectedRoute({
  children,
  roles,
  fallback = null,
  loadingFallback = null,
}: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return loadingFallback ? <>{loadingFallback}</> : null
  }

  if (!isAuthenticated || !user) {
    return fallback ? <>{fallback}</> : null
  }

  if (roles && roles.length > 0) {
    const hasRole = roles.includes(user.role) || user.role === 'admin'
    if (!hasRole) {
      return fallback ? <>{fallback}</> : null
    }
  }

  return <>{children}</>
}
