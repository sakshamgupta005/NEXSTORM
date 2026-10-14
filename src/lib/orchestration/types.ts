/**
 * Hackathon-Day Orchestration & Capability Selection - Type Contracts
 * 
 * References:
 * - Skeleton-First Directive: The starter serves the future product.
 * - Evidence-Based Architecture: Never claim success without verification evidence.
 */

export type CapabilityStatus = 'READY' | 'PARTIAL' | 'DOCUMENTED' | 'NOT_IMPLEMENTED'

export type CapabilityCategory =
  | 'Security'
  | 'Reliability'
  | 'Observability'
  | 'AI / LLM'
  | 'Agents'
  | 'Integrations'
  | 'AI / RAG'
  | 'Voice / Audio'
  | 'AI / Vision'
  | 'AI / Search'
  | 'Identity / Security'
  | 'UI Patterns'
  | 'UI Layouts'
  | 'Data & State'
  | 'Real-Time / Data'
  | 'QA / Testing'
  | 'DevOps / CI'
  | 'Data / Persistence'
  | 'Geospatial / UI'
  | 'Payments / Webhooks'
  | 'Async / Workflows'
  | 'Messaging / Alerts'
  | 'Real-Time / Collab'
  | 'Vision / Video'
  | 'Export / Reporting'
  | 'QA / Quality Gates'
  | 'Config / Flags'
  | 'API / Resilience'
  | 'UI / Analytics'
  | 'i18n / a11y'
  | 'Offline / PWA'
  | 'Forms / Validation'
  | 'AI / Benchmarks'
  | 'DevOps / Release'

export interface StarterCapability {
  id: string
  name: string
  category: CapabilityCategory
  status: CapabilityStatus
  location: string
  exports: string[]
  envKeys: string[]
  testCommand: string
  keywords: string[]
  description: string
  prerequisites?: string[]
}

export interface ProblemStatementInput {
  title: string
  description: string
  domain?: string
  targetUsers?: string[]
  constraints?: string[]
  deliverables?: string[]
  providedKeys?: string[]
}

export interface RequirementsBreakdown {
  users: string[]
  coreWorkflows: Array<{
    name: string
    description: string
    priority: 'must-have' | 'should-have' | 'could-have'
  }>
  constraints: string[]
  deliverables: string[]
  successCriteria: string[]
}

export interface ArchitectureProposal {
  frontend: {
    stack: string
    routes: string[]
    layout: string
    components: string[]
  }
  backend: {
    endpoints: string[]
    serverComponents: string[]
    serverActions: string[]
  }
  dataModel: {
    entities: Array<{ name: string; fields: string[] }>
    storageType: 'in-memory' | 'supabase-postgres' | 'hybrid'
  }
  aiComponents: {
    providers: string[]
    workflows: string[]
    hasRag: boolean
    hasVision: boolean
    hasVoice: boolean
  }
  integrations: string[]
  deployment: {
    target: 'vercel' | 'render' | 'docker' | 'self-hosted'
    healthCheckPath: string
  }
}

export interface CapabilityMatch {
  capability: StarterCapability
  relevanceScore: number // 0.0 to 1.0
  reason: string
  action: 'KEEP' | 'MODIFY' | 'REPLACE' | 'REMOVE'
}

export interface GapAnalysisItem {
  gap: string
  neededFor: string
  solution: 'implement-minimal' | 'use-mock' | 'use-starter-alternative' | 'defer'
  rationale: string
}

export interface PrioritizedTask {
  id: string
  title: string
  description: string
  priority: 1 | 2 | 3 | 4
  dependencies: string[]
  demoValue: 'critical' | 'high' | 'medium' | 'low'
  verificationCheck: string
  completed?: boolean
}

export interface HackathonOrchestrationPlan {
  problemSummary: {
    title: string
    domain: string
  }
  requirements: RequirementsBreakdown
  architecture: ArchitectureProposal
  matchedCapabilities: CapabilityMatch[]
  unneededCapabilities: string[]
  gapAnalysis: GapAnalysisItem[]
  implementationPlan: PrioritizedTask[]
  verificationPlan: Array<{
    workflow: string
    method: 'unit-test' | 'smoke-probe' | 'component-test' | 'manual-e2e'
    command: string
  }>
  executionSummary: {
    selectedCount: number
    unneededCount: number
    estimatedTasks: number
    risks: string[]
    recommendedFirstStep: string
  }
}

export interface BoundedExecutionLimits {
  maxIterations?: number
  maxToolCalls?: number
  timeoutMs?: number
  maxConsecutiveErrors?: number
}

export interface BoundedExecutionResult {
  completed: boolean
  iterations: number
  toolCallsCount: number
  durationMs: number
  stopReason: 'success' | 'iteration-limit' | 'timeout' | 'error-limit' | 'human-cancelled'
  evidence: Array<{
    check: string
    passed: boolean
    output?: string
  }>
  remainingRisks: string[]
}
