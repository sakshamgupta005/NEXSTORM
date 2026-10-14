import { describe, it, expect, vi } from 'vitest'
import {
  getAllCapabilities,
  findCapabilityById,
  getCapabilitiesByCategory,
  searchCapabilities,
  analyzeProblemStatement,
  initHackathonProject,
  formatPlanMarkdown,
  runBoundedExecutionLoop,
  type ProblemStatementInput
} from '../../src/lib/orchestration'
import type { StructuredPlan } from '../../src/lib/agent/planner'

describe('Part 4.25 — Hackathon-Day Orchestration & Capability Integration', () => {
  describe('Capability Registry (52 Capabilities)', () => {
    it('indexes all 52 capabilities with complete metadata', () => {
      const caps = getAllCapabilities()
      expect(caps.length).toBe(52)

      for (const cap of caps) {
        expect(cap.id).toBeDefined()
        expect(cap.name).toBeDefined()
        expect(cap.category).toBeDefined()
        expect(cap.status).toBe('READY')
        expect(cap.location).toBeDefined()
        expect(Array.isArray(cap.exports)).toBe(true)
        expect(Array.isArray(cap.envKeys)).toBe(true)
        expect(cap.testCommand).toContain('npm')
        expect(cap.keywords.length).toBeGreaterThan(0)
        expect(cap.description.length).toBeGreaterThan(15)
      }
    })

    it('looks up capabilities by ID and category', () => {
      const loggerCap = findCapabilityById('structured-logger')
      expect(loggerCap).toBeDefined()
      expect(loggerCap?.name).toContain('Logger')

      const aiCaps = getCapabilitiesByCategory('AI / LLM')
      expect(aiCaps.length).toBeGreaterThan(0)
      expect(aiCaps.some(c => c.id === 'unified-ai-client')).toBe(true)
    })

    it('searches capabilities by keywords and free text', () => {
      const voiceResults = searchCapabilities('voice')
      expect(voiceResults.some(c => c.id === 'speech-toolkit')).toBe(true)

      const nonExistent = searchCapabilities('quantum-teleportation-xyz')
      expect(nonExistent.length).toBe(0)
    })
  })

  describe('Capability-Selection & Planning Workflow', () => {
    const telehealthProblem: ProblemStatementInput = {
      title: 'Rural AI Telehealth Triage Assistant',
      description: 'A voice-first triage tool for rural clinic patients that records symptoms, transcribes speech, provides AI clinical summaries, and works in low-connectivity settings.',
      targetUsers: ['Rural Clinic Patient', 'Community Health Worker'],
      constraints: ['Must operate offline or under spotty network', 'Zero paid API keys for local demo'],
      deliverables: ['Voice recording & transcription demo', 'Symptom triage dashboard', 'Automated health probe'],
      providedKeys: []
    }

    it('breaks down requirements and detects must-have workflows', () => {
      const plan = analyzeProblemStatement(telehealthProblem)

      expect(plan.requirements.users).toContain('Rural Clinic Patient')
      expect(plan.requirements.coreWorkflows.length).toBeGreaterThan(1)
      expect(plan.requirements.coreWorkflows.some(w => w.priority === 'must-have')).toBe(true)
      expect(plan.requirements.constraints).toContain('Must operate offline or under spotty network')
      expect(plan.requirements.successCriteria.length).toBeGreaterThan(0)
    })

    it('proposes lean architecture matching problem requirements', () => {
      const plan = analyzeProblemStatement(telehealthProblem)

      expect(plan.architecture.frontend.routes).toContain('/')
      expect(plan.architecture.frontend.routes).toContain('/api/health')
      expect(plan.architecture.aiComponents.hasVoice).toBe(true)
      expect(plan.architecture.deployment.healthCheckPath).toBe('/api/health')
    })

    it('matches relevant capabilities and excludes unneeded modules', () => {
      const plan = analyzeProblemStatement(telehealthProblem)

      const matchedIds = plan.matchedCapabilities.map(m => m.capability.id)

      // Essential & domain-matched capabilities
      expect(matchedIds).toContain('speech-toolkit')
      expect(matchedIds).toContain('pwa-offline')
      expect(matchedIds).toContain('unified-ai-client')
      expect(matchedIds).toContain('health-probes')

      // Unneeded capabilities should be excluded or removed
      expect(plan.unneededCapabilities).toContain('payments-webhooks')

      // Relevance scores are bounded between 0 and 1
      for (const m of plan.matchedCapabilities) {
        expect(m.relevanceScore).toBeGreaterThanOrEqual(0.5)
        expect(m.relevanceScore).toBeLessThanOrEqual(1.0)
      }
    })

    it('generates topologically ordered implementation tasks', () => {
      const plan = analyzeProblemStatement(telehealthProblem)

      expect(plan.implementationPlan.length).toBeGreaterThanOrEqual(4)
      const task1 = plan.implementationPlan[0]
      expect(task1.id).toBe('task-1-baseline-health')
      expect(task1.dependencies).toEqual([])

      const task2 = plan.implementationPlan[1]
      expect(task2.dependencies).toContain('task-1-baseline-health')
    })

    it('generates executable verification plan', () => {
      const plan = analyzeProblemStatement(telehealthProblem)

      expect(plan.verificationPlan.length).toBeGreaterThanOrEqual(3)
      expect(plan.verificationPlan.some(v => v.command.includes('smoke'))).toBe(true)
      expect(plan.verificationPlan.some(v => v.command.includes('typecheck'))).toBe(true)
    })
  })

  describe('Project Initialization & Markdown Generation', () => {
    it('identifies missing environment variables without crashing', () => {
      const sampleInput: ProblemStatementInput = {
        title: 'Document Q&A RAG Engine',
        description: 'Upload PDFs and perform semantic RAG search.',
        providedKeys: []
      }

      const initResult = initHackathonProject(sampleInput, { generatePlanFile: false })

      expect(initResult.plan).toBeDefined()
      expect(typeof initResult.markdownSummary).toBe('string')
      expect(initResult.markdownSummary).toContain('# Hackathon Project Plan: Document Q&A RAG Engine')
      expect(initResult.markdownSummary).toContain('## 1. Requirements Breakdown')
      expect(initResult.markdownSummary).toContain('## 3. Capability Selection & Mapping')
      expect(initResult.markdownSummary).toContain('## 5. Prioritized Implementation Plan')
    })

    it('formats plan markdown with clear section headers', () => {
      const plan = analyzeProblemStatement({
        title: 'Emergency Response Map',
        description: 'Map hospital locations and route ambulances.'
      })

      const md = formatPlanMarkdown(plan, ['NEXT_PUBLIC_MAPBOX_TOKEN'])
      expect(md).toContain('Emergency Response Map')
      expect(md).toContain('NEXT_PUBLIC_MAPBOX_TOKEN')
      expect(md).toContain('offline mock')
    })
  })

  describe('Bounded AI Execution Loop', () => {
    it('executes within strict iteration and time limits', async () => {
      const mockPlan: StructuredPlan = {
        objective: 'Test bounded loop execution',
        acceptanceCriteria: ['Task 1 completes', 'Task 2 completes'],
        tasks: [
          {
            id: 't1',
            title: 'Initialize model',
            description: 'Init local model',
            dependencies: [],
            verificationSteps: ['check model init'],
            isDestructive: false
          },
          {
            id: 't2',
            title: 'Verify output',
            description: 'Verify model output',
            dependencies: ['t1'],
            verificationSteps: ['check output format'],
            isDestructive: false
          }
        ],
        risks: [],
        assumptions: []
      }

      const mockExecutor = vi.fn().mockResolvedValue({
        success: true,
        filesChanged: ['src/model.ts']
      })

      const result = await runBoundedExecutionLoop({
        task: 'Test execution loop',
        plan: mockPlan,
        limits: {
          maxIterations: 5,
          timeoutMs: 5000
        },
        taskExecutor: mockExecutor,
        verificationChecks: [
          {
            name: 'Unit Assertion',
            fn: () => ({ passed: true, output: 'Assertion passed' })
          }
        ]
      })

      expect(result.completed).toBe(true)
      expect(result.stopReason).toBe('success')
      expect(result.iterations).toBeGreaterThanOrEqual(2)
      expect(result.evidence.length).toBe(1)
      expect(result.evidence[0].passed).toBe(true)
      expect(mockExecutor).toHaveBeenCalledTimes(2)
    })

    it('guards destructive actions by requiring human approval', async () => {
      const destructivePlan: StructuredPlan = {
        objective: 'Delete production database',
        acceptanceCriteria: ['Table dropped'],
        tasks: [
          {
            id: 't-drop',
            title: 'Drop database table',
            description: 'Permanently remove records table',
            dependencies: [],
            verificationSteps: ['verify table deletion'],
            isDestructive: true
          }
        ],
        risks: [],
        assumptions: []
      }

      // Approval denied
      const onApproval = vi.fn().mockResolvedValue(false)

      const result = await runBoundedExecutionLoop({
        task: 'Drop database',
        plan: destructivePlan,
        onApprovalRequired: onApproval
      })

      expect(result.completed).toBe(false)
      expect(result.stopReason).toBe('human-cancelled')
      expect(result.remainingRisks.some(r => r.includes('Destructive'))).toBe(true)
      expect(onApproval).toHaveBeenCalled()
    })

    it('halts and returns error evidence when verification fails', async () => {
      const failingPlan: StructuredPlan = {
        objective: 'Implement broken feature',
        acceptanceCriteria: ['Tests pass'],
        tasks: [
          {
            id: 't-fail',
            title: 'Write broken code',
            description: 'Fails execution',
            dependencies: [],
            verificationSteps: ['verify error output'],
            isDestructive: false
          }
        ],
        risks: [],
        assumptions: []
      }

      const failingExecutor = vi.fn().mockResolvedValue({
        success: false,
        error: 'Compilation syntax error'
      })

      const result = await runBoundedExecutionLoop({
        task: 'Failing task',
        plan: failingPlan,
        taskExecutor: failingExecutor
      })

      expect(result.completed).toBe(false)
      expect(result.stopReason).toBe('error-limit')
      expect(result.remainingRisks.length).toBeGreaterThan(0)
    })
  })
})
