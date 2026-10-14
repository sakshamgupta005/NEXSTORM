import { describe, it, expect, beforeEach } from 'vitest'
import {
  getEnvironment,
  validateServerConfig,
  getClientConfig,
  assertRequiredEnv,
  ConfigurationError,
  extractEnvFlags,
  isRealConfigValue,
  calculateRolloutBucket,
  evaluateFlagWithReason,
  InMemoryFeatureFlagProvider,
  FeatureFlagManager,
  featureFlagManager,
  isFeatureEnabled,
  FeatureFlagDefinition,
} from '@/lib/config'

describe('Part 4.17 — Feature Flags & Runtime Configuration Toolkit', () => {
  beforeEach(() => {
    featureFlagManager.clearOverrides()
  })

  describe('1. Runtime Environment Configuration & Validation', () => {
    it('detects runtime environment accurately with fallback to development', () => {
      expect(getEnvironment({ NODE_ENV: 'production' })).toBe('production')
      expect(getEnvironment({ APP_ENV: 'test' })).toBe('test')
      expect(getEnvironment({})).toBe('development')
    })

    it('identifies placeholder values vs real configuration strings', () => {
      expect(isRealConfigValue('')).toBe(false)
      expect(isRealConfigValue('your-key-here')).toBe(false)
      expect(isRealConfigValue('sk-xxx')).toBe(false)
      expect(isRealConfigValue('valid_actual_secret_token_12345')).toBe(true)
    })

    it('parses valid server configuration and freezes the returned object', () => {
      const config = validateServerConfig({
        NODE_ENV: 'development',
        LOG_LEVEL: 'warn',
        NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'secret-service-key-999',
      })

      expect(config.env).toBe('development')
      expect(config.logLevel).toBe('warn')
      expect(config.supabase.url).toBe('https://test.supabase.co')
      expect(config.supabase.serviceRoleKey).toBe('secret-service-key-999')
      expect(Object.isFrozen(config)).toBe(true)
    })

    it('asserts required environment variables and throws actionable ConfigurationError', () => {
      expect(() => {
        assertRequiredEnv(['DATABASE_URL', 'CRITICAL_SECRET'], {
          DATABASE_URL: 'placeholder',
        })
      }).toThrowError(ConfigurationError)

      try {
        assertRequiredEnv(['MISSING_KEY'], {})
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ConfigurationError)
        expect((err as ConfigurationError).missingKeys).toContain('MISSING_KEY')
      }
    })

    it('ensures server-only secrets NEVER enter client configuration', () => {
      const serverConfig = validateServerConfig({
        NEXT_PUBLIC_SUPABASE_URL: 'https://public.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-public-key',
        SUPABASE_SERVICE_ROLE_KEY: 'super-sensitive-secret-key-12345',
        DATABASE_URL: 'postgres://admin:secret@db.internal:5432/prod',
      })

      const clientConfig = getClientConfig(serverConfig)

      expect(clientConfig.supabaseUrl).toBe('https://public.supabase.co')
      expect(clientConfig.supabaseAnonKey).toBe('anon-public-key')

      const clientConfigRecord = clientConfig as unknown as Record<string, unknown>
      expect(clientConfigRecord.serviceRoleKey).toBeUndefined()
      expect(clientConfigRecord.databaseUrl).toBeUndefined()
      expect(clientConfigRecord.raw).toBeUndefined()
      expect(Object.isFrozen(clientConfig)).toBe(true)
    })
  })

  describe('2. Feature Flag Precedence Rules & Safe Rollouts', () => {
    it('strictly enforces emergency kill-switch regardless of user targeting or overrides', () => {
      const flag: FeatureFlagDefinition = {
        key: 'ai-code-generation',
        defaultValue: true,
        allowedUsers: ['user_vip_123'],
        emergencyKillSwitch: true,
      }

      const overrides = new Map([['ai-code-generation', true]])
      const result = evaluateFlagWithReason(flag, { userId: 'user_vip_123' }, overrides)

      expect(result.enabled).toBe(false)
      expect(result.reason).toBe('emergency_kill_switch')
    })

    it('respects manual overrides over user targeting and default values', () => {
      const flag: FeatureFlagDefinition = {
        key: 'new-checkout',
        defaultValue: false,
        allowedUsers: ['user_1'],
      }

      const overrides = new Map([['new-checkout', false]])
      const result = evaluateFlagWithReason(flag, { userId: 'user_1' }, overrides)

      expect(result.enabled).toBe(false)
      expect(result.reason).toBe('manual_override')
    })

    it('evaluates user allowlist targeting correctly', () => {
      const flag: FeatureFlagDefinition = {
        key: 'beta-analytics',
        defaultValue: false,
        allowedUsers: ['tester_alpha', 'tester_beta'],
      }

      const targeted = evaluateFlagWithReason(flag, { targetingKey: 'tester_alpha' })
      expect(targeted.enabled).toBe(true)
      expect(targeted.reason).toBe('user_targeting')

      const untargeted = evaluateFlagWithReason(flag, { targetingKey: 'regular_user' })
      expect(untargeted.enabled).toBe(false)
      expect(untargeted.reason).toBe('default_value')
    })

    it('evaluates role targeting correctly', () => {
      const flag: FeatureFlagDefinition = {
        key: 'admin-debug-panel',
        defaultValue: false,
        requiredRoles: ['admin', 'maintainer'],
      }

      const adminUser = evaluateFlagWithReason(flag, { userRole: 'admin' })
      expect(adminUser.enabled).toBe(true)
      expect(adminUser.reason).toBe('role_targeting')

      const regularUser = evaluateFlagWithReason(flag, { userRole: 'member' })
      expect(regularUser.enabled).toBe(false)
      expect(regularUser.reason).toBe('default_value')
    })

    it('enforces environment constraints and disables flag outside allowed environments', () => {
      const flag: FeatureFlagDefinition = {
        key: 'experimental-feature',
        defaultValue: true,
        enabledEnvironments: ['development', 'test'],
      }

      const inDev = evaluateFlagWithReason(flag, { environment: 'development' })
      expect(inDev.enabled).toBe(true)

      const inProd = evaluateFlagWithReason(flag, { environment: 'production' })
      expect(inProd.enabled).toBe(false)
      expect(inProd.reason).toBe('environment_disabled')
    })

    it('performs deterministic percentage-based rollouts using FNV-1a hashing', () => {
      const flagKey = 'speed-boost-v2'
      const user1 = 'usr_001_seed'
      const user2 = 'usr_002_seed'

      const bucket1 = calculateRolloutBucket(flagKey, user1)
      const bucket2 = calculateRolloutBucket(flagKey, user2)

      // Identical inputs must yield identical hash buckets every time
      expect(calculateRolloutBucket(flagKey, user1)).toBe(bucket1)
      expect(bucket1).toBeGreaterThanOrEqual(0)
      expect(bucket1).toBeLessThan(100)
      expect(bucket2).toBeGreaterThanOrEqual(0)
      expect(bucket2).toBeLessThan(100)

      const flagDef: FeatureFlagDefinition = {
        key: flagKey,
        defaultValue: false,
        percentageRollout: 50,
      }

      const res1 = evaluateFlagWithReason(flagDef, { targetingKey: user1 })
      expect(res1.reason).toBe('percentage_rollout')
      expect(res1.enabled).toBe(bucket1 < 50)

      // 100% rollout must enable for all users
      const fullRollout: FeatureFlagDefinition = {
        key: flagKey,
        defaultValue: false,
        percentageRollout: 100,
      }
      expect(evaluateFlagWithReason(fullRollout, { targetingKey: user1 }).enabled).toBe(true)
      expect(evaluateFlagWithReason(fullRollout, { targetingKey: user2 }).enabled).toBe(true)

      // 0% rollout must disable for all users
      const zeroRollout: FeatureFlagDefinition = {
        key: flagKey,
        defaultValue: false,
        percentageRollout: 0,
      }
      expect(evaluateFlagWithReason(zeroRollout, { targetingKey: user1 }).enabled).toBe(false)
      expect(evaluateFlagWithReason(zeroRollout, { targetingKey: user2 }).enabled).toBe(false)
    })
  })

  describe('3. FeatureFlagManager & Provider Fallbacks', () => {
    it('manages flag registration, evaluation, and dynamic overrides', () => {
      const manager = new FeatureFlagManager()
      manager.registerFlag({
        key: 'dark-mode',
        defaultValue: false,
      })

      expect(manager.isEnabled('dark-mode')).toBe(false)

      manager.setOverride('dark-mode', true)
      expect(manager.isEnabled('dark-mode')).toBe(true)

      manager.clearOverrides()
      expect(manager.isEnabled('dark-mode')).toBe(false)
    })

    it('handles provider failures gracefully with safe fallback', () => {
      const manager = new FeatureFlagManager()

      // Faulty provider that throws an unexpected error
      const brokenProvider = {
        name: 'faulty-remote-service',
        isEnabled: () => {
          throw new Error('503 Service Unavailable')
        },
      }
      manager.addProvider(brokenProvider)

      // Fallback returns false without crashing
      expect(manager.isEnabled('unregistered-remote-flag')).toBe(false)
    })

    it('evaluates flags using InMemoryFeatureFlagProvider and global isFeatureEnabled', () => {
      const provider = new InMemoryFeatureFlagProvider([
        { key: 'local-test-flag', defaultValue: true },
      ])
      expect(provider.isEnabled('local-test-flag')).toBe(true)
      expect(provider.isEnabled('unknown-flag')).toBe(false)

      expect(isFeatureEnabled('unregistered-global-flag')).toBe(false)
    })

    it('extracts feature flags from environment variable strings', () => {
      const env = {
        FEATURE_FLAG_VOICE_CHAT: 'true',
        NEXT_PUBLIC_FLAG_COMPACT_TABLES: '1',
        FEATURE_FLAG_DISABLED_TOOL: 'false',
        NORMAL_VARIABLE: 'something',
      }

      const extracted = extractEnvFlags(env)
      expect(extracted['voice-chat']).toBe(true)
      expect(extracted['compact-tables']).toBe(true)
      expect(extracted['disabled-tool']).toBe(false)
    })

    it('demonstrates that UI flags do NOT substitute for server-side authorization', () => {
      // Security principle test:
      // Even if 'admin-portal' flag evaluates to true on the frontend,
      // server operations must independently verify the user's role/session.
      const manager = new FeatureFlagManager()
      manager.registerFlag({
        key: 'admin-portal',
        defaultValue: true, // Enabled for all in UI
      })

      const isUiVisible = manager.isEnabled('admin-portal')
      expect(isUiVisible).toBe(true)

      // Simulated server action / endpoint guard:
      function deleteDatabaseRecord(session: { userRole: string }): { success: boolean; error?: string } {
        if (session.userRole !== 'admin') {
          return { success: false, error: 'Unauthorized: Admin role required' }
        }
        return { success: true }
      }

      const nonAdminSession = { userRole: 'member' }
      const serverAttempt = deleteDatabaseRecord(nonAdminSession)

      // Server rejects operation despite UI flag being enabled
      expect(serverAttempt.success).toBe(false)
      expect(serverAttempt.error).toContain('Unauthorized')
    })
  })
})
