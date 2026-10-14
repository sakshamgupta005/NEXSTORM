import { STARTER_CAPABILITIES } from './capability-registry'
import type {
  ProblemStatementInput,
  HackathonOrchestrationPlan,
  RequirementsBreakdown,
  ArchitectureProposal,
  CapabilityMatch,
  GapAnalysisItem,
  PrioritizedTask
} from './types'

/**
 * Capability Selector & Hackathon Planning Engine
 * 
 * Maps open-ended problem statements into concrete, minimal architectures
 * and executable implementation plans using the Hackathon Starter's capabilities.
 */

export function analyzeProblemStatement(
  input: ProblemStatementInput
): HackathonOrchestrationPlan {
  const text = `${input.title} ${input.description} ${(input.constraints || []).join(' ')} ${(input.deliverables || []).join(' ')}`.toLowerCase()

  // 1. Requirements Breakdown
  const detectedUsers = input.targetUsers && input.targetUsers.length > 0
    ? input.targetUsers
    : extractUsersFromText(text)

  const workflows = extractWorkflowsFromText(text, input)
  
  const constraints = input.constraints && input.constraints.length > 0
    ? input.constraints
    : [
        'Time-bounded hackathon delivery',
        'Minimal external dependencies',
        'Zero crash on missing environment variables',
        'Responsive on mobile and desktop'
      ]

  const deliverables = input.deliverables && input.deliverables.length > 0
    ? input.deliverables
    : [
        'Working web application with live demo flows',
        'Automated test suite proving core functionality',
        'Deployment-ready build with health probe'
      ]

  const successCriteria = [
    'All primary user workflows execute end-to-end without unhandled errors',
    'No paid external keys required for deterministic local evaluation',
    'All test gates pass (typecheck, lint, unit tests, build)'
  ]

  const requirements: RequirementsBreakdown = {
    users: detectedUsers,
    coreWorkflows: workflows,
    constraints,
    deliverables,
    successCriteria
  }

  // 2. Capability Mapping
  const { matchedCapabilities, unneededCapabilities } = mapCapabilitiesToProblem(text)

  // 3. Architecture Proposal
  const architecture = proposeArchitecture(input, text, matchedCapabilities)

  // 4. Gap Analysis
  const gapAnalysis = analyzeGaps(text)

  // 5. Prioritized Implementation Plan (Topologically Ordered)
  const implementationPlan = generateImplementationPlan(
    input,
    matchedCapabilities,
    gapAnalysis,
    architecture
  )

  // 6. Verification Plan
  const verificationPlan = generateVerificationPlan(workflows)

  // 7. Execution Summary
  const selectedCount = matchedCapabilities.filter(m => m.action === 'KEEP' || m.action === 'MODIFY').length
  const unneededCount = unneededCapabilities.length

  const risks: string[] = []
  const requiredEnvKeys = Array.from(
    new Set(
      matchedCapabilities
        .filter(m => m.action === 'KEEP' || m.action === 'MODIFY')
        .flatMap(m => m.capability.envKeys)
    )
  )
  const provided = new Set(input.providedKeys || [])
  const missingKeys = requiredEnvKeys.filter(k => !provided.has(k))

  if (missingKeys.length > 0) {
    risks.push(`External credentials missing: ${missingKeys.join(', ')}. Use offline mock adapters for local demo reliability.`)
  }
  if (gapAnalysis.some(g => g.solution === 'implement-minimal')) {
    risks.push('Custom domain features require minimal implementations; prioritize Must-Have workflows first.')
  }
  risks.push('Do not build unnecessary dashboards or extra pages before proving core demo workflow.')

  return {
    problemSummary: {
      title: input.title,
      domain: input.domain || inferDomain(text)
    },
    requirements,
    architecture,
    matchedCapabilities,
    unneededCapabilities,
    gapAnalysis,
    implementationPlan,
    verificationPlan,
    executionSummary: {
      selectedCount,
      unneededCount,
      estimatedTasks: implementationPlan.length,
      risks,
      recommendedFirstStep: 'Run `npm test` and `npm run typecheck` to confirm baseline health, then implement Task 1.'
    }
  }
}

function extractUsersFromText(text: string): string[] {
  const users: string[] = []
  if (text.includes('patient') || text.includes('doctor') || text.includes('clinic')) {
    users.push('Patient', 'Healthcare Provider')
  } else if (text.includes('student') || text.includes('teacher') || text.includes('school')) {
    users.push('Student', 'Instructor')
  } else if (text.includes('merchant') || text.includes('buyer') || text.includes('shopper')) {
    users.push('Shopper', 'Store Admin')
  } else if (text.includes('dev') || text.includes('engineer')) {
    users.push('Developer', 'System Administrator')
  } else {
    users.push('Primary End User', 'Administrator')
  }
  return users
}

function extractWorkflowsFromText(
  text: string,
  input: ProblemStatementInput
): RequirementsBreakdown['coreWorkflows'] {
  const workflows: RequirementsBreakdown['coreWorkflows'] = []

  // Core primary workflow
  workflows.push({
    name: 'Primary User Interaction Flow',
    description: `Complete the central user task described in "${input.title}".`,
    priority: 'must-have'
  })

  if (text.includes('auth') || text.includes('login') || text.includes('user') || text.includes('account')) {
    workflows.push({
      name: 'User Authentication & Session Management',
      description: 'Sign up, sign in, and persist user credentials/session.',
      priority: 'must-have'
    })
  }

  if (text.includes('ai') || text.includes('llm') || text.includes('generate') || text.includes('agent')) {
    workflows.push({
      name: 'AI Intelligence Generation / Processing',
      description: 'Process user input through AI/LLM models and return structured responses.',
      priority: 'must-have'
    })
  }

  if (text.includes('upload') || text.includes('file') || text.includes('document') || text.includes('ocr')) {
    workflows.push({
      name: 'Document / File Ingestion & Parsing',
      description: 'Upload files safely, validate constraints, and parse content.',
      priority: 'should-have'
    })
  }

  if (text.includes('export') || text.includes('report') || text.includes('download')) {
    workflows.push({
      name: 'Data Export & Reporting',
      description: 'Export analyzed results to CSV/JSON or downloadable reports.',
      priority: 'could-have'
    })
  }

  return workflows
}

function inferDomain(text: string): string {
  if (text.includes('health') || text.includes('med') || text.includes('patient')) return 'Healthcare / Telehealth'
  if (text.includes('fin') || text.includes('payment') || text.includes('money') || text.includes('crypto')) return 'FinTech'
  if (text.includes('edu') || text.includes('learn') || text.includes('student')) return 'EdTech'
  if (text.includes('ecommerce') || text.includes('shop') || text.includes('cart')) return 'E-Commerce'
  if (text.includes('agent') || text.includes('autonomous') || text.includes('workflow')) return 'Autonomous AI & Agents'
  return 'General Web & AI Application'
}

function mapCapabilitiesToProblem(
  text: string
): { matchedCapabilities: CapabilityMatch[]; unneededCapabilities: string[] } {
  const matches: CapabilityMatch[] = []
  const unneeded: string[] = []

  // Always essential baseline capabilities
  const baselineIds = [
    'safe-redirects',
    'api-client-resilience',
    'structured-logger',
    'api-response',
    'health-probes',
    'security-headers',
    'sanitization',
    'zero-crash-env',
    'ui-components',
    'layout-shells',
    'state-views',
    'deployment-release'
  ]

  for (const cap of STARTER_CAPABILITIES) {
    let score = 0
    let reason = ''
    let action: 'KEEP' | 'MODIFY' | 'REPLACE' | 'REMOVE' = 'REMOVE'

    // Check baseline
    if (baselineIds.includes(cap.id)) {
      score = 0.95
      reason = 'Core infrastructure capability required for all reliable hackathon deliveries.'
      action = 'KEEP'
    } else {
      // Keyword matching
      const matchingKeywords = cap.keywords.filter(k => text.includes(k.toLowerCase()))
      if (matchingKeywords.length > 0) {
        score = Math.min(1.0, 0.4 + matchingKeywords.length * 0.2)
        reason = `Matches problem keywords: ${matchingKeywords.join(', ')}.`
        action = 'KEEP'
      } else if (cap.category === 'AI / LLM' && (text.includes('ai') || text.includes('agent') || text.includes('intelligence'))) {
        score = 0.85
        reason = 'AI generation is central to the problem statement.'
        action = 'KEEP'
      } else if (cap.category === 'Identity / Security' && (text.includes('user') || text.includes('patient') || text.includes('member'))) {
        score = 0.75
        reason = 'User authentication or role-based access is needed.'
        action = 'KEEP'
      } else if (cap.category === 'Forms / Validation' && (text.includes('form') || text.includes('submit') || text.includes('input'))) {
        score = 0.7
        reason = 'Form inputs and step validation required.'
        action = 'KEEP'
      }
    }

    // Specific domain adjustments
    if (cap.id === 'payments-webhooks' && !text.includes('pay') && !text.includes('stripe') && !text.includes('subscri') && !text.includes('billing')) {
      score = 0.1
      action = 'REMOVE'
      reason = 'No billing or payment requirements in problem statement.'
    }
    if (cap.id === 'maps-geospatial' && !text.includes('map') && !text.includes('location') && !text.includes('geo') && !text.includes('gps') && !text.includes('route')) {
      score = 0.1
      action = 'REMOVE'
      reason = 'No geolocation or mapping requirements detected.'
    }
    if (cap.id === 'speech-toolkit' && !text.includes('voice') && !text.includes('speech') && !text.includes('audio') && !text.includes('talk')) {
      score = 0.1
      action = 'REMOVE'
      reason = 'No voice or audio requirements detected.'
    }

    if (score >= 0.5) {
      matches.push({
        capability: cap,
        relevanceScore: Number(score.toFixed(2)),
        reason,
        action
      })
    } else {
      unneeded.push(cap.id)
    }
  }

  // Sort matched by relevance descending
  matches.sort((a, b) => b.relevanceScore - a.relevanceScore)

  return { matchedCapabilities: matches, unneededCapabilities: unneeded }
}

function proposeArchitecture(
  input: ProblemStatementInput,
  text: string,
  matches: CapabilityMatch[]
): ArchitectureProposal {
  const routes = ['/', '/api/health']
  const endpoints = ['/api/health']
  const serverComponents = ['src/app/page.tsx']
  const serverActions: string[] = []
  const components = ['AppShell', 'Button', 'Card', 'Badge', 'StateViews']

  const hasAuth = matches.some(m => m.capability.id === 'auth-toolkit' || m.capability.id === 'supabase-integration')
  if (hasAuth) {
    routes.push('/login', '/dashboard')
    endpoints.push('/api/auth/signout')
    serverComponents.push('src/app/dashboard/page.tsx')
    serverActions.push('signInAction', 'signOutAction')
    components.push('LoginForm', 'Navbar')
  }

  const hasAI = matches.some(m => m.capability.category === 'AI / LLM' || m.capability.category === 'Agents')
  if (hasAI) {
    endpoints.push('/api/ai/generate')
    components.push('AIInteractionPanel')
  }

  const hasRag = matches.some(m => m.capability.id === 'rag-toolkit')
  const hasVision = matches.some(m => m.capability.id === 'vision-toolkit' || m.capability.id === 'computer-vision-video')
  const hasVoice = matches.some(m => m.capability.id === 'speech-toolkit')

  return {
    frontend: {
      stack: 'Next.js 16 (App Router), React 19, Tailwind CSS v4',
      routes,
      layout: 'src/components/layout/app-shell.tsx',
      components
    },
    backend: {
      endpoints,
      serverComponents,
      serverActions
    },
    dataModel: {
      entities: [
        { name: 'User', fields: ['id', 'email', 'role', 'createdAt'] },
        { name: 'CoreSession', fields: ['id', 'userId', 'status', 'data', 'createdAt'] }
      ],
      storageType: hasAuth ? 'supabase-postgres' : 'in-memory'
    },
    aiComponents: {
      providers: ['mock', 'openai', 'gemini'],
      workflows: hasAI ? ['Direct Response', 'Structured Extraction'] : [],
      hasRag,
      hasVision,
      hasVoice
    },
    integrations: matches
      .filter(m => m.capability.category === 'Integrations' || m.capability.envKeys.length > 0)
      .map(m => m.capability.name),
    deployment: {
      target: 'render',
      healthCheckPath: '/api/health'
    }
  }
}

function analyzeGaps(
  text: string
): GapAnalysisItem[] {
  const gaps: GapAnalysisItem[] = []

  // Check domain specific gaps
  if (text.includes('blockchain') || text.includes('smart contract') || text.includes('web3')) {
    gaps.push({
      gap: 'Web3 / Smart Contract Interaction',
      neededFor: 'Decentralized ledger transactions',
      solution: 'use-mock',
      rationale: 'Starter does not bundle blockchain libraries; simulate ledger hash with deterministic mock.'
    })
  }

  if (text.includes('pdf generate') || text.includes('invoice pdf')) {
    gaps.push({
      gap: 'Pixel-perfect PDF layout renderer',
      neededFor: 'Document export',
      solution: 'use-starter-alternative',
      rationale: 'Use starter export-reporting HTML/CSV generator instead of heavy Chromium headless print.'
    })
  }

  return gaps
}

function generateImplementationPlan(
  input: ProblemStatementInput,
  matches: CapabilityMatch[],
  gaps: GapAnalysisItem[],
  arch: ArchitectureProposal
): PrioritizedTask[] {
  const tasks: PrioritizedTask[] = []

  // Task 1: Baseline Health
  tasks.push({
    id: 'task-1-baseline-health',
    title: 'Verify starter baseline health and environment configuration',
    description: 'Run tsc and test suites to verify unpolluted environment before making domain edits.',
    priority: 1,
    dependencies: [],
    demoValue: 'critical',
    verificationCheck: 'npm run typecheck && npm test tests/unit/env.test.ts'
  })

  // Task 2: Domain Data Model & Types
  tasks.push({
    id: 'task-2-domain-types',
    title: 'Define domain data models and type contracts',
    description: `Create type declarations and Zod schemas for ${input.title} entities (${arch.dataModel.entities.map(e => e.name).join(', ')}).`,
    priority: 1,
    dependencies: ['task-1-baseline-health'],
    demoValue: 'critical',
    verificationCheck: 'npm run typecheck'
  })

  // Task 3: Core Business Logic & Service
  tasks.push({
    id: 'task-3-core-service',
    title: 'Implement core service layer with fallback mock support',
    description: 'Wire business logic and AI/persistence calls. Ensure deterministic mock fallback operates if API keys are unset.',
    priority: 2,
    dependencies: ['task-2-domain-types'],
    demoValue: 'critical',
    verificationCheck: 'npm test tests/unit/'
  })

  // Task 4: UI Screen & Workflow Assembly
  tasks.push({
    id: 'task-4-ui-assembly',
    title: 'Assemble responsive UI screens using starter components',
    description: `Construct user-facing routes (${arch.frontend.routes.join(', ')}) using AppShell, StateViews, and form validation.`,
    priority: 2,
    dependencies: ['task-3-core-service'],
    demoValue: 'critical',
    verificationCheck: 'npm run build'
  })

  // Task 5: End-to-End Demo Journey Verification
  tasks.push({
    id: 'task-5-e2e-verification',
    title: 'Automate verification of primary user demo journey',
    description: 'Write deterministic automated tests and smoke probes verifying user interaction from entry to resolution.',
    priority: 3,
    dependencies: ['task-4-ui-assembly'],
    demoValue: 'high',
    verificationCheck: 'npm test && npm run release:check'
  })

  // Task 6: Release & Demo Packaging
  tasks.push({
    id: 'task-6-release-packaging',
    title: 'Verify Docker build and deployment readiness',
    description: 'Confirm health probes return 200 and production bundle builds smoothly with zero missing asset errors.',
    priority: 4,
    dependencies: ['task-5-e2e-verification'],
    demoValue: 'medium',
    verificationCheck: 'npm run verify'
  })

  return tasks
}

function generateVerificationPlan(
  workflows: RequirementsBreakdown['coreWorkflows']
): HackathonOrchestrationPlan['verificationPlan'] {
  const plan: HackathonOrchestrationPlan['verificationPlan'] = []

  // Base checks
  plan.push({
    workflow: 'System Boot & Health Probe',
    method: 'smoke-probe',
    command: 'npm run smoke:test'
  })

  plan.push({
    workflow: 'Static Type & Code Safety',
    method: 'unit-test',
    command: 'npm run typecheck && npm run lint'
  })

  for (const wf of workflows) {
    plan.push({
      workflow: wf.name,
      method: 'unit-test',
      command: 'npm test tests/unit/'
    })
  }

  plan.push({
    workflow: 'Master Quality Verification Gate',
    method: 'component-test',
    command: 'npm run verify'
  })

  return plan
}
