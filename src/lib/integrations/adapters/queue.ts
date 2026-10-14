/**
 * Background Jobs & Queue Integration Adapter
 * 
 * Reference: BullMQ (https://github.com/taskforcesh/bullmq)
 * License: MIT
 * 
 * Implements a lightweight in-memory background job queue inspired by BullMQ:
 * - Job priority ordering
 * - Lifecycle status tracking (waiting -> active -> completed/failed)
 * - Retries with error recording
 * - Queue metrics and stats
 * - Works anywhere without requiring Redis or dedicated workers
 */

import type { IntegrationDefinition } from '../registry'
import type {
  QueueAddJobInput,
  QueueJob,
  QueueJobOutput,
  QueueJobStats,
} from '../types'

export class InMemoryQueue<TData = unknown, TResult = unknown> {
  private jobs = new Map<string, QueueJob<TData, TResult>>()
  private idCounter = 1

  add(input: QueueAddJobInput<TData>): QueueJob<TData, TResult> {
    const id = `job-${Date.now()}-${this.idCounter++}`
    const job: QueueJob<TData, TResult> = {
      id,
      name: input.name,
      data: input.data,
      priority: input.priority ?? 0,
      delayMs: input.delayMs,
      maxAttempts: input.maxAttempts ?? 3,
      attempts: 0,
      status: 'waiting',
      createdAt: Date.now(),
    }

    this.jobs.set(id, job)
    return job
  }

  get(id: string): QueueJob<TData, TResult> | undefined {
    return this.jobs.get(id)
  }

  async processNext(
    worker: (job: QueueJob<TData, TResult>) => Promise<TResult>
  ): Promise<QueueJob<TData, TResult> | null> {
    // Find highest priority waiting job
    const waiting = Array.from(this.jobs.values())
      .filter((j) => j.status === 'waiting')
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))

    if (waiting.length === 0) return null

    const job = waiting[0]
    job.status = 'active'
    job.attempts = (job.attempts ?? 0) + 1
    job.processedAt = Date.now()

    try {
      const result = await worker(job)
      job.status = 'completed'
      job.result = result
      job.finishedAt = Date.now()
      return job
    } catch (err) {
      job.error = err instanceof Error ? err.message : String(err)
      if ((job.attempts ?? 1) >= (job.maxAttempts ?? 3)) {
        job.status = 'failed'
      } else {
        job.status = 'waiting' // Eligible for retry
      }
      job.finishedAt = Date.now()
      return job
    }
  }

  getStats(): QueueJobStats {
    let waiting = 0
    let active = 0
    let completed = 0
    let failed = 0

    this.jobs.forEach((j) => {
      if (j.status === 'waiting') waiting++
      else if (j.status === 'active') active++
      else if (j.status === 'completed') completed++
      else if (j.status === 'failed') failed++
    })

    return {
      waiting,
      active,
      completed,
      failed,
      total: this.jobs.size,
    }
  }

  clear(): void {
    this.jobs.clear()
  }
}

export const sharedInMemoryQueue = new InMemoryQueue()

export const inMemoryQueueDefinition: IntegrationDefinition<
  QueueAddJobInput,
  QueueJobOutput
> = {
  id: 'queue:in-memory',
  category: 'queue',
  name: 'In-Memory Job Queue',
  description:
    'Lightweight zero-dependency background task queue inspired by BullMQ pattern',
  referenceRepo: 'https://github.com/taskforcesh/bullmq',
  license: 'MIT',
  requiredEnvVars: [],
  optionalDependencies: ['bullmq', 'ioredis'],
  isConfigured: () => true,
  checkHealth: async () => {
    const stats = sharedInMemoryQueue.getStats()
    return {
      status: 'healthy',
      message: `Queue operational. Total jobs: ${stats.total}, Waiting: ${stats.waiting}`,
      details: { ...stats },
    }
  },
  createAdapter: () => ({
    execute: async (input) => {
      const job = sharedInMemoryQueue.add(input)
      return {
        jobId: job.id,
        status: job.status,
      }
    },
    checkHealth: async () => {
      const stats = sharedInMemoryQueue.getStats()
      return {
        status: 'healthy',
        message: `Queue stats: ${stats.waiting} waiting, ${stats.active} active`,
        details: { ...stats },
      }
    },
  }),
}
