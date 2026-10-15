/**
 * src/lib/alerts/preflight.ts
 * Production Deployment Preflight Tooling for NEXSTORM P21.
 * Audits environment secrets, persistence durability, provider readiness,
 * and operational rollout state without exposing secrets or PII.
 */

import { isSupabaseConfigured } from '../supabase/config'
import { evaluateCityReadiness } from '../city/readiness'
import { listSupportedCities } from '../city/registry'
import { EmailProvider, SmsProvider, WebhookProvider } from './providers/base'
import { getAlertRepository } from './repository'
import { getRolloutMode, isKillSwitchActive } from './rollout'
const PLACEHOLDER_PATTERNS = [
  /^your[-_]?.*$/i,
  /^placeholder[-_]?.*$/i,
  /^change[-_]?me.*$/i,
  /^insert[-_]?.*$/i,
  /^todo[-_]?.*$/i,
  /^example[-_]?.*$/i,
  /^test[-_]?key.*$/i,
  /^sk[-_]proj[-_]xxxx+.*$/i,
  /^sk[-_]ant[-_]xxxx+.*$/i,
]

export function isPlaceholderSecret(val?: string | null): boolean {
  if (!val) return true
  const trimmed = val.trim()
  if (trimmed.length === 0) return true
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(trimmed))
}
import type { RolloutMode } from './types'

export type CheckStatus = 'PASS' | 'WARN' | 'FAIL'

export interface PreflightCheck {
  id: string
  name: string
  status: CheckStatus
  message: string
  remediation?: string
}

export interface PreflightReport {
  ready: boolean
  evaluatedAt: string
  rolloutMode: RolloutMode
  killSwitchActive: boolean
  checks: PreflightCheck[]
  summary: {
    pass: number
    warn: number
    fail: number
  }
}


/**
 * Runs a comprehensive deployment preflight audit.
 * Fails closed if production dispatch is attempted without required security and infrastructure.
 */
export async function runDeploymentPreflight(
  targetMode?: RolloutMode,
  targetCityId?: string
): Promise<PreflightReport> {
  const rolloutMode = targetMode || getRolloutMode()
  const killSwitch = isKillSwitchActive()
  const checks: PreflightCheck[] = []

  // 1. Rollout Mode Check
  checks.push({
    id: 'rollout_mode',
    name: 'Rollout Governance Mode',
    status: 'PASS',
    message: `Active dispatch rollout mode is '${rolloutMode}'.`,
  })

  // 2. Kill Switch Check
  if (killSwitch) {
    checks.push({
      id: 'kill_switch',
      name: 'Operator Kill Switch',
      status: 'WARN',
      message: 'DISPATCH_KILL_SWITCH is currently active; all outbound notifications will be suppressed.',
      remediation: 'Unset DISPATCH_KILL_SWITCH when ready to permit authorized dispatches.',
    })
  } else {
    checks.push({
      id: 'kill_switch',
      name: 'Operator Kill Switch',
      status: 'PASS',
      message: 'Kill switch is disengaged. Outbound dispatches are governed by rollout mode.',
    })
  }

  // 3. Operator Secret Check (ALERT_OPERATOR_KEY)
  const operatorKey = process.env.ALERT_OPERATOR_KEY
  if (!operatorKey || isPlaceholderSecret(operatorKey)) {
    if (rolloutMode === 'evaluation_only') {
      checks.push({
        id: 'operator_key',
        name: 'Operator Authorization Key',
        status: 'WARN',
        message: 'ALERT_OPERATOR_KEY is missing or placeholder. Public dispatch endpoint will reject calls.',
        remediation: 'Generate a strong 32+ character random secret for ALERT_OPERATOR_KEY.',
      })
    } else {
      checks.push({
        id: 'operator_key',
        name: 'Operator Authorization Key',
        status: 'FAIL',
        message: 'ALERT_OPERATOR_KEY is missing or contains an insecure placeholder.',
        remediation: 'Set ALERT_OPERATOR_KEY to a cryptographically random secret with at least 32 characters.',
      })
    }
  } else if (operatorKey.length < 16) {
    checks.push({
      id: 'operator_key',
      name: 'Operator Authorization Key',
      status: 'FAIL',
      message: `ALERT_OPERATOR_KEY length (${operatorKey.length}) is insufficient; minimum is 16 characters.`,
      remediation: 'Use a secret with 32+ characters (e.g. openssl rand -hex 32).',
    })
  } else {
    checks.push({
      id: 'operator_key',
      name: 'Operator Authorization Key',
      status: 'PASS',
      message: 'ALERT_OPERATOR_KEY meets length and format requirements.',
    })
  }

  // 4. Webhook Signing Secret Check (ALERT_WEBHOOK_SECRET)
  const webhookSecret = process.env.ALERT_WEBHOOK_SECRET
  if (!webhookSecret || isPlaceholderSecret(webhookSecret)) {
    if (rolloutMode === 'evaluation_only') {
      checks.push({
        id: 'webhook_secret',
        name: 'Webhook Signing Secret',
        status: 'WARN',
        message: 'ALERT_WEBHOOK_SECRET is unconfigured; default fallback key will be used for preview HMAC.',
        remediation: 'Configure ALERT_WEBHOOK_SECRET with a strong random secret before enabling webhooks.',
      })
    } else {
      checks.push({
        id: 'webhook_secret',
        name: 'Webhook Signing Secret',
        status: 'FAIL',
        message: 'ALERT_WEBHOOK_SECRET is missing or contains an insecure placeholder.',
        remediation: 'Set ALERT_WEBHOOK_SECRET to a strong random HMAC key before production rollout.',
      })
    }
  } else if (webhookSecret.length < 16) {
    checks.push({
      id: 'webhook_secret',
      name: 'Webhook Signing Secret',
      status: 'WARN',
      message: `ALERT_WEBHOOK_SECRET length (${webhookSecret.length}) is below recommended 32 characters.`,
      remediation: 'Increase ALERT_WEBHOOK_SECRET to at least 32 characters.',
    })
  } else {
    checks.push({
      id: 'webhook_secret',
      name: 'Webhook Signing Secret',
      status: 'PASS',
      message: 'ALERT_WEBHOOK_SECRET meets security requirements.',
    })
  }

  // 5. Persistence Durability Check
  const repository = getAlertRepository()
  const hasSupabase = isSupabaseConfigured()

  if (hasSupabase && repository.isDurable()) {
    checks.push({
      id: 'persistence_durability',
      name: 'Persistence & RLS Database',
      status: 'PASS',
      message: 'Connected to durable Supabase PostgreSQL with PostGIS capabilities.',
    })
  } else if (rolloutMode === 'limited_rollout' || rolloutMode === 'general_availability') {
    checks.push({
      id: 'persistence_durability',
      name: 'Persistence & RLS Database',
      status: 'FAIL',
      message: 'Durable Supabase PostgreSQL is required for limited rollout or GA dispatch.',
      remediation:
        'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to connect to durable PostgreSQL storage.',
    })
  } else {
    checks.push({
      id: 'persistence_durability',
      name: 'Persistence & RLS Database',
      status: 'WARN',
      message: 'Running with local file-backed storage. Data will not survive container restarts or multi-instance scaling.',
      remediation: 'Configure Supabase credentials for production durability.',
    })
  }

  // 6. Outbound Provider Readiness Check
  const emailProvider = new EmailProvider()
  const smsProvider = new SmsProvider()
  const webhookProvider = new WebhookProvider()

  const emailConfigured = emailProvider.isConfigured()
  const smsConfigured = smsProvider.isConfigured()
  const webhookConfigured = webhookProvider.isConfigured()

  if (rolloutMode === 'evaluation_only') {
    checks.push({
      id: 'provider_readiness',
      name: 'Outbound Provider Readiness',
      status: 'PASS',
      message: 'evaluation_only mode active: Outbound providers are safely unneeded.',
    })
  } else if (rolloutMode === 'test_mode') {
    checks.push({
      id: 'provider_readiness',
      name: 'Outbound Provider Readiness',
      status: 'PASS',
      message: 'test_mode active: Deterministic test adapter handles dispatches safely.',
    })
  } else {
    // limited_rollout or GA
    if (!emailConfigured && !smsConfigured && !webhookConfigured) {
      checks.push({
        id: 'provider_readiness',
        name: 'Outbound Provider Readiness',
        status: 'FAIL',
        message: 'No outbound provider is configured with verified live credentials.',
        remediation: 'Configure at least one channel (SendGrid for Email, Twilio for SMS, or signed Webhook).',
      })
    } else {
      const activeChannels = [
        emailConfigured ? 'Email' : null,
        smsConfigured ? 'SMS' : null,
        webhookConfigured ? 'Webhook' : null,
      ]
        .filter(Boolean)
        .join(', ')
      checks.push({
        id: 'provider_readiness',
        name: 'Outbound Provider Readiness',
        status: 'PASS',
        message: `Configured outbound providers: ${activeChannels}.`,
      })
    }
  }

  // 7. City Configuration & Geographic Readiness Gate
  const targetCities = targetCityId ? [targetCityId.toLowerCase()] : listSupportedCities()
  for (const cid of targetCities) {
    try {
      const readiness = evaluateCityReadiness(cid)
      if (rolloutMode !== 'evaluation_only' && readiness.determinedState !== 'pilot_eligible') {
        checks.push({
          id: `city_readiness_${cid}`,
          name: `City Readiness Gate (${cid})`,
          status: 'FAIL',
          message: `City '${cid}' is in '${readiness.determinedState}' readiness state; non-evaluation rollout requires 'pilot_eligible'.`,
          remediation: `Keep rollout mode as 'evaluation_only' until verified historical incident evidence is established for ${cid}.`,
        })
      } else if (readiness.determinedState === 'evidence_insufficient') {
        checks.push({
          id: `city_readiness_${cid}`,
          name: `City Readiness Gate (${cid})`,
          status: 'WARN',
          message: `City '${cid}' lacks historical ground-truth flood evidence; outputs permitted for internal research only.`,
          remediation: `Conduct historical municipal event collection to advance ${cid} to evaluation_ready.`,
        })
      } else {
        checks.push({
          id: `city_readiness_${cid}`,
          name: `City Readiness Gate (${cid})`,
          status: 'PASS',
          message: `City '${cid}' readiness is '${readiness.determinedState}' (${readiness.summary.passedCount}/${readiness.summary.totalCount} checks passed).`,
        })
      }
    } catch (err) {
      checks.push({
        id: `city_readiness_${cid}`,
        name: `City Readiness Gate (${cid})`,
        status: 'FAIL',
        message: `City readiness evaluation error for '${cid}': ${err instanceof Error ? err.message : String(err)}`,
        remediation: `Inspect city artifacts in public/data/cities/${cid}/.`,
      })
    }
  }

  // Tally results
  const passCount = checks.filter((c) => c.status === 'PASS').length
  const warnCount = checks.filter((c) => c.status === 'WARN').length
  const failCount = checks.filter((c) => c.status === 'FAIL').length

  const ready = failCount === 0

  return {
    ready,
    evaluatedAt: new Date().toISOString(),
    rolloutMode,
    killSwitchActive: killSwitch,
    checks,
    summary: {
      pass: passCount,
      warn: warnCount,
      fail: failCount,
    },
  }
}
