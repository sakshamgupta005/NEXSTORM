/**
 * CASL-Inspired Isomorphic Authorization & Ability Engine
 * 
 * Provides:
 * - Declarative Ability rules (action, subject, condition)
 * - Wildcard support ('manage' matches all actions, 'all' matches all subjects)
 * - Inverted rules (cannot overrides can)
 * - ABAC attribute conditions (e.g. project.ownerId === user.id)
 * - Server-side guards (requireAuth, requireRole, requirePermission)
 */

import type {
  AuthUser,
  AuthAction,
  AuthSubject,
  AbilityRule,
  RoleDefinition,
  IAbility,
} from './types'

export class Ability implements IAbility {
  public rules: AbilityRule<unknown>[]

  constructor(rules: AbilityRule<unknown>[] = []) {
    this.rules = rules
  }

  can(action: AuthAction, subject: AuthSubject, context?: unknown): boolean {
    let matched = false

    for (const rule of this.rules) {
      // 1. Check action match
      const ruleActions = Array.isArray(rule.action) ? rule.action : [rule.action]
      const actionMatches =
        ruleActions.includes('manage') ||
        ruleActions.includes(action) ||
        action === 'manage'

      if (!actionMatches) continue

      // 2. Check subject match
      const ruleSubjects = Array.isArray(rule.subject) ? rule.subject : [rule.subject]
      const subjectMatches =
        ruleSubjects.includes('all') ||
        ruleSubjects.includes(subject) ||
        subject === 'all'

      if (!subjectMatches) continue

      // 3. Check condition if present
      if (rule.conditions) {
        if (!context || !rule.conditions(context)) {
          continue
        }
      }

      // If inverted rule matches, access is explicitly denied
      if (rule.inverted) {
        return false
      }

      matched = true
    }

    return matched
  }

  cannot(action: AuthAction, subject: AuthSubject, context?: unknown): boolean {
    return !this.can(action, subject, context)
  }
}

export const DEFAULT_ROLES: Record<string, RoleDefinition> = {
  admin: {
    name: 'admin',
    rules: [{ action: 'manage', subject: 'all' }],
  },
  editor: {
    name: 'editor',
    rules: [
      { action: ['read', 'create', 'update'], subject: 'all' },
      { action: 'delete', subject: 'all', inverted: true },
    ],
  },
  user: {
    name: 'user',
    rules: [
      { action: 'read', subject: 'all' },
      { action: 'create', subject: ['Project', 'Document'] },
      {
        action: ['update', 'delete'],
        subject: ['Project', 'Document'],
        // ABAC condition: can only edit own resources
        conditions: (ctx: unknown) => {
          if (!ctx || typeof ctx !== 'object') return true
          const rec = ctx as { ownerId?: string; userId?: string; authorId?: string }
          return Boolean(rec.ownerId || rec.userId || rec.authorId)
        },
      },
    ],
  },
  viewer: {
    name: 'viewer',
    rules: [{ action: 'read', subject: 'all' }],
  },
  guest: {
    name: 'guest',
    rules: [{ action: 'read', subject: ['Project', 'Document'] }],
  },
}

/**
 * Creates an Ability instance for a user based on their role and permissions.
 */
export function defineAbilityFor(
  user: AuthUser | null,
  customRoles?: Record<string, RoleDefinition>
): IAbility {
  if (!user) {
    // Unauthenticated guest ability
    const guestRole = customRoles?.guest || DEFAULT_ROLES.guest
    return new Ability(guestRole.rules)
  }

  const roleName = user.role?.toLowerCase() || 'user'
  const roles = { ...DEFAULT_ROLES, ...(customRoles || {}) }

  let baseRules: AbilityRule<unknown>[] = []

  if (roles[roleName]) {
    baseRules = [...roles[roleName].rules]
  } else {
    // Fallback to user role
    baseRules = [...DEFAULT_ROLES.user.rules]
  }

  // If user has specific explicit permissions attached
  if (user.permissions && user.permissions.length > 0) {
    for (const perm of user.permissions) {
      if (perm === '*') {
        baseRules.push({ action: 'manage', subject: 'all' })
      } else if (perm.includes(':')) {
        const [action, subject] = perm.split(':')
        baseRules.push({ action, subject })
      }
    }
  }

  // Adjust ownership conditions dynamically to user.id
  const refinedRules = baseRules.map((rule) => {
    if (rule.conditions && roleName === 'user') {
      return {
        ...rule,
        conditions: (ctx: unknown) => {
          if (!ctx || typeof ctx !== 'object') return true
          const rec = ctx as { ownerId?: string; userId?: string; authorId?: string }
          const entityOwner = rec.ownerId || rec.userId || rec.authorId
          return entityOwner === user.id
        },
      }
    }
    return rule
  })

  return new Ability(refinedRules)
}

// ---------------------------------------------------------------------------
// Server-Side Authorization Guards & Helpers
// ---------------------------------------------------------------------------

export interface ServerGuardError {
  status: 401 | 403
  code: 'UNAUTHORIZED' | 'FORBIDDEN'
  message: string
}

export function requireRole(
  user: AuthUser | null,
  allowedRoles: string | string[]
): { allowed: boolean; error?: ServerGuardError } {
  if (!user) {
    return {
      allowed: false,
      error: {
        status: 401,
        code: 'UNAUTHORIZED',
        message: 'Authentication required to access this resource.',
      },
    }
  }

  const allowed = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]
  const hasRole = allowed.includes(user.role) || user.role === 'admin'

  if (!hasRole) {
    return {
      allowed: false,
      error: {
        status: 403,
        code: 'FORBIDDEN',
        message: `Forbidden: User role "${user.role}" does not have required permissions (requires: ${allowed.join(', ')}).`,
      },
    }
  }

  return { allowed: true }
}

export function requirePermission(
  ability: IAbility,
  action: AuthAction,
  subject: AuthSubject,
  context?: unknown
): { allowed: boolean; error?: ServerGuardError } {
  if (ability.cannot(action, subject, context)) {
    return {
      allowed: false,
      error: {
        status: 403,
        code: 'FORBIDDEN',
        message: `Forbidden: Cannot perform action "${action}" on subject "${subject}".`,
      },
    }
  }

  return { allowed: true }
}
