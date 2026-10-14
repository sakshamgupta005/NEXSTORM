/**
 * Reusable Testing & Quality Automation Toolkit — Type Definitions
 */

export interface MockRequestOptions {
  method?: string
  headers?: Record<string, string>
  body?: unknown
  params?: Record<string, string>
  searchParams?: Record<string, string>
}

export interface HttpRouteMock {
  url: string | RegExp
  method?: string
  status?: number
  headers?: Record<string, string>
  response: unknown | ((req: Request) => Promise<unknown> | unknown)
}

export interface DeterministicClock {
  now(): Date
  timestamp(): number
  advance(ms: number): void
  set(time: Date | number): void
  restore(): void
}

export interface StructuredOutputValidationResult<T> {
  success: boolean
  data?: T
  error?: string
  rawExtractedJson?: unknown
  format: 'json_raw' | 'json_markdown' | 'invalid'
}

export interface ToolCallValidationResult {
  valid: boolean
  matchedName: boolean
  argsValid: boolean
  error?: string
}

export interface CitationGroundingResult {
  grounded: boolean
  citationCount: number
  citations: string[]
  groundingScore: number // 0.0 to 1.0 (approximate token/keyword overlap with source corpus)
  unsupportedClaims: string[]
}

export interface PromptInjectionVector {
  id: string
  name: string
  category: 'direct_override' | 'jailbreak' | 'system_leak' | 'delimiter_collision' | 'markdown_exfiltration'
  payload: string
  expectedResistance: string
}

export interface AgentLoopStep {
  stepNumber: number
  thought?: string
  action?: string
  toolCall?: { name: string; args: unknown }
  done?: boolean
}

export interface AgentLoopEvaluationResult {
  terminated: boolean
  exceededMaxSteps: boolean
  stepCount: number
  maxAllowedSteps: number
  terminalActionIdentified: boolean
  hasInfiniteLoopPattern: boolean
  reason: string
}

export interface QualityGateStep {
  name: string
  command: string
  durationMs: number
  status: 'passed' | 'failed' | 'skipped'
  error?: string
}

export interface VerificationSummary {
  timestamp: string
  allPassed: boolean
  passedCount: number
  failedCount: number
  skippedCount: number
  totalDurationMs: number
  steps: QualityGateStep[]
}
