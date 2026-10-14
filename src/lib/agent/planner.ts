/**
 * Structured Task Planner
 * 
 * Capabilities:
 * - Generates validated, structured implementation plans from user tasks
 * - Enforces objective, acceptance criteria, ordered tasks, dependencies, risks, and assumptions
 * - Validates dependency integrity and detects circular dependencies
 * - Topologically resolves next executable tasks
 * - Safe mock plan support for 100% deterministic offline testing
 */

import { z } from 'zod'
import { generateStructured } from '../ai/client'
import type { AIOptions } from '../ai/types'

export const PlannedTaskSchema = z.object({
  id: z.string().min(1, 'Task ID must not be empty'),
  title: z.string().min(1, 'Task title must not be empty'),
  description: z.string().min(1, 'Task description must not be empty'),
  dependencies: z.array(z.string()).default([]),
  verificationSteps: z.array(z.string()).default([]),
  isDestructive: z.boolean().default(false),
})

export type PlannedTask = z.infer<typeof PlannedTaskSchema>

export const StructuredPlanSchema = z.object({
  objective: z.string().min(1, 'Objective must not be empty'),
  acceptanceCriteria: z.array(z.string().min(1)).min(1, 'Plan must contain at least one acceptance criterion'),
  tasks: z.array(PlannedTaskSchema).min(1, 'Plan must contain at least one task'),
  risks: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([]),
})

export type StructuredPlan = z.infer<typeof StructuredPlanSchema>

export interface PlannerOptions {
  task: string
  context?: Record<string, unknown>
  mockPlan?: StructuredPlan
  aiOptions?: Partial<AIOptions>
}

export interface PlanValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Validates a plan's task dependencies to ensure all referenced IDs exist
 * and no circular dependencies exist.
 */
export function validatePlanDependencies(plan: StructuredPlan): PlanValidationResult {
  const errors: string[] = []
  const taskIds = new Set(plan.tasks.map((t) => t.id))

  // 1. Check for duplicate task IDs
  const seenIds = new Set<string>()
  for (const t of plan.tasks) {
    if (seenIds.has(t.id)) {
      errors.push(`Duplicate task ID '${t.id}' found in plan.`)
    }
    seenIds.add(t.id)
  }

  // 2. Check for missing dependency references
  for (const t of plan.tasks) {
    for (const dep of t.dependencies) {
      if (!taskIds.has(dep)) {
        errors.push(`Task '${t.id}' references non-existent dependency '${dep}'.`)
      }
      if (dep === t.id) {
        errors.push(`Task '${t.id}' cannot depend on itself.`);
      }
    }
  }

  // 3. Check for dependency cycles using DFS
  const graph = new Map<string, string[]>()
  for (const t of plan.tasks) {
    graph.set(t.id, t.dependencies)
  }

  const visited = new Set<string>()
  const recursionStack = new Set<string>()

  function hasCycle(nodeId: string): boolean {
    visited.add(nodeId)
    recursionStack.add(nodeId)

    const neighbors = graph.get(nodeId) || []
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (hasCycle(neighbor)) return true
      } else if (recursionStack.has(neighbor)) {
        return true
      }
    }

    recursionStack.delete(nodeId)
    return false
  }

  for (const t of plan.tasks) {
    if (!visited.has(t.id)) {
      if (hasCycle(t.id)) {
        errors.push(`Circular dependency detected involving task '${t.id}'.`)
        break
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Returns the subset of tasks whose dependencies have all been satisfied
 * and have not yet been marked completed.
 */
export function getExecutableTasks(
  plan: StructuredPlan,
  completedTaskIds: Set<string>
): PlannedTask[] {
  return plan.tasks.filter((task) => {
    if (completedTaskIds.has(task.id)) {
      return false
    }
    return task.dependencies.every((dep) => completedTaskIds.has(dep))
  })
}

/**
 * Converts a user task into a validated structured plan using AI or deterministic mock.
 */
export async function createStructuredPlan(options: PlannerOptions): Promise<StructuredPlan> {
  if (options.mockPlan) {
    const parsed = StructuredPlanSchema.safeParse(options.mockPlan)
    if (!parsed.success) {
      const issueDetails = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')
      throw new Error(`Invalid mock plan: ${issueDetails}`)
    }
    const depCheck = validatePlanDependencies(parsed.data)
    if (!depCheck.valid) {
      throw new Error(`Invalid mock plan dependencies: ${depCheck.errors.join('; ')}`)
    }
    return parsed.data
  }

  const prompt = `You are a software architect. Break down the following task into a structured, minimal, execution-ready plan.
Task: ${options.task}
${options.context ? `Context: ${JSON.stringify(options.context)}` : ''}

Requirements:
- Define clear, measurable acceptance criteria.
- Break down into small, concrete, ordered implementation tasks.
- Specify task dependencies using unique task IDs (e.g. task-1, task-2).
- Mark potentially destructive actions (e.g. file deletion, database drop, remote push) with isDestructive: true.
- Identify testing/verification steps for each task.
- List risks and assumptions.`

  const result = await generateStructured<StructuredPlan>({
    prompt,
    schema: StructuredPlanSchema,
    provider: options.aiOptions?.provider ?? 'mock',
    model: options.aiOptions?.model,
    apiKey: options.aiOptions?.apiKey,
    mockResponse: {
      objective: options.task,
      acceptanceCriteria: ['Task executed successfully', 'Verification passed'],
      tasks: [
        {
          id: 'task-1',
          title: 'Implement Task',
          description: options.task,
          dependencies: [],
          verificationSteps: ['Run tests'],
          isDestructive: false,
        },
      ],
      risks: ['Mock plan execution'],
      assumptions: ['Environment is ready'],
    },
  })

  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to generate structured plan')
  }

  const depCheck = validatePlanDependencies(result.data)
  if (!depCheck.valid) {
    throw new Error(`Generated plan has invalid dependencies: ${depCheck.errors.join('; ')}`)
  }

  return result.data
}
