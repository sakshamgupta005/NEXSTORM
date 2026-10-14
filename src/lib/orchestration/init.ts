import fs from 'node:fs'
import path from 'node:path'
import { analyzeProblemStatement } from './selector'
import type {
  ProblemStatementInput,
  HackathonOrchestrationPlan
} from './types'

export interface InitOptions {
  generatePlanFile?: boolean
  outputPath?: string
  checkEnv?: boolean
}

export interface InitResult {
  plan: HackathonOrchestrationPlan
  markdownSummary: string
  missingEnvKeys: string[]
  planFilePath?: string
}

/**
 * Initializes a hackathon project plan from a problem statement.
 * Generates HACKATHON-PLAN.md with selected capabilities, tasks, and env analysis.
 */
export function initHackathonProject(
  input: ProblemStatementInput,
  options: InitOptions = {}
): InitResult {
  const plan = analyzeProblemStatement(input)

  // Identify required environment keys across kept/modified capabilities
  const requiredEnvKeys = Array.from(
    new Set(
      plan.matchedCapabilities
        .filter(m => m.action === 'KEEP' || m.action === 'MODIFY')
        .flatMap(m => m.capability.envKeys)
    )
  )

  const missingEnvKeys = requiredEnvKeys.filter(key => {
    const val = process.env[key]
    return !val || val.trim() === '' || val.includes('placeholder') || val.includes('your_')
  })

  // Generate markdown documentation
  const markdownSummary = formatPlanMarkdown(plan, missingEnvKeys)

  let planFilePath: string | undefined
  if (options.generatePlanFile !== false) {
    const outPath = options.outputPath || path.join(process.cwd(), 'HACKATHON-PLAN.md')
    fs.writeFileSync(outPath, markdownSummary, 'utf8')
    planFilePath = outPath
  }

  return {
    plan,
    markdownSummary,
    missingEnvKeys,
    planFilePath
  }
}

export function formatPlanMarkdown(
  plan: HackathonOrchestrationPlan,
  missingEnvKeys: string[]
): string {
  const lines: string[] = []

  lines.push(`# Hackathon Project Plan: ${plan.problemSummary.title}`)
  lines.push('')
  lines.push(`**Domain:** ${plan.problemSummary.domain}`)
  lines.push(`**Generated:** ${new Date().toISOString()}`)
  lines.push('')
  lines.push('> Skeleton-First Principle: The starter serves the future product. Keep only what proves the product.')
  lines.push('')

  // 1. Requirements Breakdown
  lines.push('## 1. Requirements Breakdown')
  lines.push('')
  lines.push(`- **Target Users:** ${plan.requirements.users.join(', ')}`)
  lines.push('- **Core Workflows:**')
  for (const wf of plan.requirements.coreWorkflows) {
    lines.push(`  - [${wf.priority.toUpperCase()}] **${wf.name}**: ${wf.description}`)
  }
  lines.push('- **Key Constraints:**')
  for (const c of plan.requirements.constraints) {
    lines.push(`  - ${c}`)
  }
  lines.push('- **Success Criteria:**')
  for (const sc of plan.requirements.successCriteria) {
    lines.push(`  - ${sc}`)
  }
  lines.push('')

  // 2. Architecture Proposal
  lines.push('## 2. Architecture Proposal')
  lines.push('')
  lines.push(`- **Frontend Stack:** ${plan.architecture.frontend.stack}`)
  lines.push(`- **Key Routes:** ${plan.architecture.frontend.routes.map(r => `\`${r}\``).join(', ')}`)
  lines.push(`- **Data Storage:** ${plan.architecture.dataModel.storageType}`)
  lines.push(`- **Deployment Target:** ${plan.architecture.deployment.target} (Health: \`${plan.architecture.deployment.healthCheckPath}\`)`)
  if (plan.architecture.aiComponents.workflows.length > 0) {
    lines.push(`- **AI Workflows:** ${plan.architecture.aiComponents.workflows.join(', ')} (Providers: ${plan.architecture.aiComponents.providers.join(', ')})`)
  }
  lines.push('')

  // 3. Capability Mapping
  lines.push('## 3. Capability Selection & Mapping')
  lines.push('')
  lines.push(`**Selected Capabilities (${plan.executionSummary.selectedCount}):**`)
  lines.push('')
  lines.push('| Capability | Category | Action | Relevance | Reason |')
  lines.push('| :--- | :--- | :---: | :---: | :--- |')
  for (const m of plan.matchedCapabilities) {
    lines.push(`| **${m.capability.name}** | ${m.capability.category} | \`${m.action}\` | ${(m.relevanceScore * 100).toFixed(0)}% | ${m.reason} |`)
  }
  lines.push('')
  lines.push(`**Unneeded Starter Modules (${plan.executionSummary.unneededCount}):**`)
  lines.push(`Ignored to keep the build lean: ${plan.unneededCapabilities.slice(0, 10).join(', ')}...`)
  lines.push('')

  // 4. Environment & Credentials Status
  lines.push('## 4. Environment & Credentials Status')
  lines.push('')
  if (missingEnvKeys.length === 0) {
    lines.push('✅ All required environment variables are present or using zero-crash defaults.')
  } else {
    lines.push('⚠️ **Unset or Placeholder Credentials Detected:**')
    for (const key of missingEnvKeys) {
      lines.push(`- \`${key}\`: Not configured. Use built-in offline mock adapters for local demo.`)
    }
  }
  lines.push('')

  // 5. Prioritized Implementation Tasks
  lines.push('## 5. Prioritized Implementation Plan')
  lines.push('')
  for (const task of plan.implementationPlan) {
    lines.push(`### [P${task.priority}] ${task.title}`)
    lines.push(`- **Task ID:** \`${task.id}\``)
    lines.push(`- **Description:** ${task.description}`)
    lines.push(`- **Demo Value:** **${task.demoValue.toUpperCase()}**`)
    if (task.dependencies.length > 0) {
      lines.push(`- **Dependencies:** ${task.dependencies.map(d => `\`${d}\``).join(', ')}`)
    }
    lines.push(`- **Verification:** \`${task.verificationCheck}\``)
    lines.push('')
  }

  // 6. Verification Plan
  lines.push('## 6. Verification Plan')
  lines.push('')
  lines.push('| Workflow / Gate | Verification Method | Command |')
  lines.push('| :--- | :---: | :--- |')
  for (const v of plan.verificationPlan) {
    lines.push(`| ${v.workflow} | \`${v.method}\` | \`${v.command}\` |`)
  }
  lines.push('')

  // 7. Execution Summary & Risks
  lines.push('## 7. Execution Summary & Risks')
  lines.push('')
  for (const risk of plan.executionSummary.risks) {
    lines.push(`- ⚠️ **Risk:** ${risk}`)
  }
  lines.push('')
  lines.push(`**Recommended First Action:** ${plan.executionSummary.recommendedFirstStep}`)
  lines.push('')

  return lines.join('\n')
}
