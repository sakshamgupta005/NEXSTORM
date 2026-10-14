import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  LocalJobQueue,
  JobScheduler,
  JobWorkflowEngine,
  JobWorkflowBuilder,
} from '@/lib/jobs'
import { InMemoryCheckpointStorage } from '@/lib/agent/checkpoint'

describe('Part 4.10 — Background Jobs & Workflow Toolkit', () => {
  let queue: LocalJobQueue

  beforeEach(() => {
    queue = new LocalJobQueue({
      concurrency: 2,
      pollIntervalMs: 25,
      idempotencyTtlMs: 5000,
    })
  })

  afterEach(async () => {
    await queue.stop(100)
  })

  describe('1. Job Registration & Execution', () => {
    it('registers a job handler and executes successfully with typed data and result', async () => {
      queue.registerHandler<{ text: string }, { uppercase: string }>(
        'convert-upper',
        async (job) => {
          return { uppercase: job.data.text.toUpperCase() }
        }
      )

      const job = await queue.enqueue('convert-upper', { text: 'hello world' })
      expect(job.status).toBe('queued')
      expect(job.name).toBe('convert-upper')

      // Wait for completion
      await vi.waitFor(() => {
        return queue.getJob(job.id).then((j) => {
          if (!j || j.status !== 'completed') throw new Error('Not completed yet')
          return j
        })
      }, { timeout: 1000 })

      const completed = await queue.getJob<{ text: string }, { uppercase: string }>(job.id)
      expect(completed?.status).toBe('completed')
      expect(completed?.result).toEqual({ uppercase: 'HELLO WORLD' })
      expect(completed?.attempts).toBe(1)
    })

    it('records structured failure when job throws without retries', async () => {
      queue.registerHandler('faulty-task', async () => {
        throw new Error('Database connection failed')
      })

      const job = await queue.enqueue('faulty-task', {}, {
        retryPolicy: { maxRetries: 0 },
        isIdempotent: false,
      })

      await vi.waitFor(() => {
        return queue.getJob(job.id).then((j) => {
          if (!j || j.status !== 'failed') throw new Error('Not failed yet')
          return j
        })
      }, { timeout: 1000 })

      const failed = await queue.getJob(job.id)
      expect(failed?.status).toBe('failed')
      expect(failed?.error?.message).toContain('Database connection failed')
      expect(failed?.error?.isFinal).toBe(true)
    })

    it('fails when no handler is registered for a job', async () => {
      const job = await queue.enqueue('unregistered-worker', {})

      await vi.waitFor(() => {
        return queue.getJob(job.id).then((j) => {
          if (!j || j.status !== 'failed') throw new Error('Not failed')
          return j
        })
      }, { timeout: 1000 })

      const failed = await queue.getJob(job.id)
      expect(failed?.error?.message).toContain("No handler registered for job name: 'unregistered-worker'")
    })
  })

  describe('2. Retry Limits, Backoff & Non-Idempotent Protection', () => {
    it('retries idempotent job up to maxRetries before marking as failed', async () => {
      let attempts = 0
      queue.registerHandler('flaky-idempotent-task', async () => {
        attempts++
        throw new Error(`Transient network glitch attempt ${attempts}`)
      })

      const job = await queue.enqueue('flaky-idempotent-task', {}, {
        isIdempotent: true,
        retryPolicy: {
          maxRetries: 2,
          backoffMs: 25,
          strategy: 'fixed',
        },
      })

      await vi.waitFor(() => {
        return queue.getJob(job.id).then((j) => {
          if (!j || j.status !== 'failed') throw new Error('Still attempting')
          return j
        })
      }, { timeout: 2000 })

      const finalJob = await queue.getJob(job.id)
      expect(finalJob?.status).toBe('failed')
      // 1 initial attempt + 2 retries = 3 attempts total
      expect(finalJob?.attempts).toBe(3)
      expect(finalJob?.error?.isFinal).toBe(true)
      expect(attempts).toBe(3)
    })

    it('refuses automatic retry on non-idempotent jobs without nonIdempotentSafe flag', async () => {
      let runCount = 0
      queue.registerHandler('payment-charge', async () => {
        runCount++
        throw new Error('Bank gateway timeout')
      })

      // Non-idempotent operation with maxRetries specified
      const job = await queue.enqueue('payment-charge', { amount: 5000 }, {
        isIdempotent: false,
        retryPolicy: {
          maxRetries: 3,
          backoffMs: 20,
          nonIdempotentSafe: false,
        },
      })

      await vi.waitFor(() => {
        return queue.getJob(job.id).then((j) => {
          if (!j || j.status !== 'failed') throw new Error('Not failed')
          return j
        })
      }, { timeout: 1000 })

      const result = await queue.getJob(job.id)
      expect(result?.status).toBe('failed')
      // Should strictly halt after 1 attempt to avoid duplicate charges!
      expect(result?.attempts).toBe(1)
      expect(runCount).toBe(1)
    })
  })

  describe('3. Timeouts, Cancellation & Concurrency', () => {
    it('times out long-running job exceeding timeoutMs', async () => {
      queue.registerHandler('slow-task', async (_, ctx) => {
        return new Promise((resolve) => {
          const timer = setTimeout(() => resolve('done'), 1000)
          ctx.signal.addEventListener('abort', () => clearTimeout(timer))
        })
      })

      const job = await queue.enqueue('slow-task', {}, {
        timeoutMs: 50,
        retryPolicy: { maxRetries: 0 },
      })

      await vi.waitFor(() => {
        return queue.getJob(job.id).then((j) => {
          if (!j || j.status !== 'failed') throw new Error('Not failed')
          return j
        })
      }, { timeout: 1000 })

      const failed = await queue.getJob(job.id)
      expect(failed?.status).toBe('failed')
      expect(failed?.error?.message).toContain('timed out after 50ms')
    })

    it('cancels a queued job before it starts processing', async () => {
      queue.registerHandler('delayed-job', async () => 'done')

      const job = await queue.enqueue('delayed-job', {}, { delayMs: 5000 })
      expect(job.status).toBe('queued')

      const cancelled = await queue.cancelJob(job.id)
      expect(cancelled).toBe(true)

      const cancelledJob = await queue.getJob(job.id)
      expect(cancelledJob?.status).toBe('cancelled')
    })

    it('respects concurrency limit across multiple jobs', async () => {
      let activeWorkers = 0
      let maxObservedActive = 0

      queue.registerHandler('concurrency-test', async () => {
        activeWorkers++
        maxObservedActive = Math.max(maxObservedActive, activeWorkers)
        await new Promise((resolve) => setTimeout(resolve, 80))
        activeWorkers--
        return true
      })

      // Queue 5 jobs into concurrency: 2 queue
      const promises = [1, 2, 3, 4, 5].map(() => queue.enqueue('concurrency-test', {}))
      const jobs = await Promise.all(promises)

      await vi.waitFor(async () => {
        const stats = await queue.getStats()
        if (stats.completed !== 5) throw new Error('Not all completed')
      }, { timeout: 2000 })

      // Concurrency was configured to 2 in beforeEach
      expect(maxObservedActive).toBeLessThanOrEqual(2)
      for (const j of jobs) {
        const finished = await queue.getJob(j.id)
        expect(finished?.status).toBe('completed')
      }
    })
  })

  describe('4. Submission Idempotency & Progress Telemetry', () => {
    it('returns existing job when enqueued with identical idempotencyKey', async () => {
      queue.registerHandler('dedup-task', async () => {
        await new Promise((r) => setTimeout(r, 100))
        return { ok: true }
      })

      const job1 = await queue.enqueue('dedup-task', { id: 1 }, { idempotencyKey: 'order_123' })
      const job2 = await queue.enqueue('dedup-task', { id: 1 }, { idempotencyKey: 'order_123' })

      expect(job1.id).toBe(job2.id)
      const stats = await queue.getStats()
      expect(stats.total).toBe(1)
    })

    it('emits progress telemetry updates during execution', async () => {
      const progressUpdates: number[] = []

      queue.on((event) => {
        if (event.type === 'job:progress' && event.progress) {
          progressUpdates.push(event.progress.percent)
        }
      })

      queue.registerHandler('progress-task', async (_, ctx) => {
        await ctx.updateProgress(25, 'Step 1')
        await ctx.updateProgress(50, 'Step 2')
        await ctx.updateProgress(100, 'Done')
        return 'success'
      })

      const job = await queue.enqueue('progress-task', {})

      await vi.waitFor(async () => {
        const j = await queue.getJob(job.id)
        if (j?.status !== 'completed') throw new Error('Not completed')
      }, { timeout: 1000 })

      expect(progressUpdates).toContain(25)
      expect(progressUpdates).toContain(50)
      expect(progressUpdates).toContain(100)
    })
  })

  describe('5. Multi-Step Workflow Orchestration & Checkpoint Resumability', () => {
    interface PipelineContext extends Record<string, unknown> {
      rawInput: string
      sanitized?: string
      aiAnalysis?: string
      saved?: boolean
    }

    it('executes a 5-step sequential pipeline: validate -> process -> AI -> verify -> save', async () => {
      const storage = new InMemoryCheckpointStorage<PipelineContext>()
      const progressHistory: number[] = []

      const builder = new JobWorkflowBuilder<PipelineContext>()
        .step({
          id: 'validate',
          name: 'Validate Input',
          execute: (ctx) => {
            if (!ctx.context.rawInput) return { success: false, error: 'Empty input' }
            return { success: true }
          },
        })
        .step({
          id: 'process',
          name: 'Process & Sanitize',
          execute: (ctx) => ({
            success: true,
            patchContext: { sanitized: ctx.context.rawInput.trim().toLowerCase() },
          }),
        })
        .step({
          id: 'call_ai',
          name: 'Call AI Model',
          execute: (ctx) => ({
            success: true,
            patchContext: { aiAnalysis: `Analyzed: ${ctx.context.sanitized}` },
          }),
        })
        .step({
          id: 'verify',
          name: 'Verify Result',
          execute: (ctx) => ({
            success: Boolean(ctx.context.aiAnalysis?.includes('Analyzed')),
          }),
        })
        .step({
          id: 'save',
          name: 'Save Output',
          isMutating: true,
          execute: () => ({
            success: true,
            patchContext: { saved: true },
          }),
        })

      const engine = new JobWorkflowEngine<PipelineContext>({
        workflowId: 'wf_pipeline_1',
        initialContext: { rawInput: '  HACKATHON LAUNCH EVENT  ' },
        steps: builder.build(),
        checkpointStorage: storage,
        onProgress: (pct) => progressHistory.push(pct),
      })

      const result = await engine.run()
      expect(result.status).toBe('completed')
      expect(result.context.sanitized).toBe('hackathon launch event')
      expect(result.context.aiAnalysis).toContain('Analyzed: hackathon launch event')
      expect(result.context.saved).toBe(true)
      expect(result.completedSteps).toEqual(['validate', 'process', 'call_ai', 'verify', 'save'])
      expect(progressHistory).toContain(100)

      // Verify checkpoint saved in storage
      const stored = storage.loadCheckpoint('wf_pipeline_1')
      expect(stored?.status).toBe('completed')
      expect(stored?.nextStepId).toBeNull()
    })

    it('resumes interrupted workflow from stored checkpoint without re-running completed steps', async () => {
      const storage = new InMemoryCheckpointStorage<PipelineContext>()
      const stepExecutionCount: Record<string, number> = {
        validate: 0,
        process: 0,
        call_ai: 0,
      }

      const steps = [
        {
          id: 'validate',
          name: 'Validate',
          execute: () => {
            stepExecutionCount.validate++
            return { success: true, patchContext: { sanitized: 'valid' } }
          },
        },
        {
          id: 'process',
          name: 'Process',
          execute: () => {
            stepExecutionCount.process++
            return { success: true }
          },
        },
        {
          id: 'call_ai',
          name: 'AI Call',
          execute: () => {
            stepExecutionCount.call_ai++
            return { success: true, patchContext: { aiAnalysis: 'done' } }
          },
        },
      ]

      // Simulate a previously interrupted checkpoint after 'validate'
      storage.saveCheckpoint({
        version: 1,
        workflowId: 'resumed_wf',
        nextStepId: 'process',
        completedSteps: [{ stepId: 'validate', stepName: 'Validate', attempts: 1, durationMs: 10, success: true }],
        context: { rawInput: 'test', sanitized: 'valid' },
        status: 'interrupted',
        updatedAt: Date.now(),
      })

      const resumedEngine = new JobWorkflowEngine<PipelineContext>({
        workflowId: 'resumed_wf',
        initialContext: { rawInput: 'test' },
        steps,
        checkpointStorage: storage,
      })

      const outcome = await resumedEngine.run()
      expect(outcome.status).toBe('completed')
      // 'validate' step should NOT have been re-executed!
      expect(stepExecutionCount.validate).toBe(0)
      // Remaining steps executed
      expect(stepExecutionCount.process).toBe(1)
      expect(stepExecutionCount.call_ai).toBe(1)
      expect(outcome.context.aiAnalysis).toBe('done')
    })

    it('supports conditional branching and jumping', async () => {
      const executedSteps: string[] = []

      const builder = new JobWorkflowBuilder<{ role: string; VIPAccess?: boolean }>()
        .branch(
          'check_role',
          'Evaluate Role',
          (ctx) => ctx.role === 'admin',
          'grant_admin',
          'grant_user'
        )
        .step({
          id: 'grant_user',
          name: 'Grant User Access',
          execute: () => {
            executedSteps.push('user')
            return { success: true, patchContext: { VIPAccess: false }, skipRemaining: true }
          },
        })
        .step({
          id: 'grant_admin',
          name: 'Grant VIP Admin Access',
          execute: () => {
            executedSteps.push('admin')
            return { success: true, patchContext: { VIPAccess: true } }
          },
        })

      const engine = new JobWorkflowEngine({
        workflowId: 'branch_wf',
        initialContext: { role: 'admin' },
        steps: builder.build(),
      })

      const outcome = await engine.run()
      expect(outcome.status).toBe('completed')
      expect(executedSteps).toEqual(['admin'])
      expect(outcome.context.VIPAccess).toBe(true)
    })
  })

  describe('6. Recurring Job Scheduling', () => {
    it('registers recurring schedule and prevents duplicate schedule IDs', () => {
      const scheduler = new JobScheduler()

      const schedule = scheduler.registerRecurring({
        id: 'nightly_cleanup',
        name: 'cleanup_temp',
        data: { maxAgeHours: 24 },
        intervalMs: 3600000,
      })

      expect(schedule.id).toBe('nightly_cleanup')
      expect(schedule.enabled).toBe(true)
      expect(schedule.nextRunAt).toBeGreaterThan(Date.now())

      // Duplicate registration throws
      expect(() => {
        scheduler.registerRecurring({
          id: 'nightly_cleanup',
          name: 'cleanup_temp',
          data: {},
          intervalMs: 1000,
        })
      }).toThrow(/already registered/)
    })

    it('parses standard 5-field cron patterns to calculate future execution time', () => {
      const scheduler = new JobScheduler()
      const now = new Date('2026-10-12T12:00:00Z').getTime()

      // Every 15 minutes: '*/15 * * * *'
      const nextRun = scheduler.computeNextCronRun('*/15 * * * *', now)
      expect(nextRun).toBeGreaterThan(now)
      const nextDate = new Date(nextRun)
      expect(nextDate.getMinutes() % 15).toBe(0)
    })

    it('dispatches due jobs to target queue during scheduler tick', async () => {
      const scheduler = new JobScheduler(queue)
      queue.registerHandler('tick_task', async () => 'ticked')

      scheduler.registerRecurring({
        id: 'instant_recurring',
        name: 'tick_task',
        data: { run: true },
        intervalMs: 50,
      })

      // Manually set nextRunAt to past to simulate due time
      const item = scheduler.getRecurring('instant_recurring')
      if (item) {
        item.nextRunAt = Date.now() - 100
      }

      const dispatched = await scheduler.tick()
      expect(dispatched).toBe(1)

      const stats = await queue.getStats()
      expect(stats.total).toBe(1)
    })
  })

  describe('7. Graceful Shutdown & Cleanup', () => {
    it('drains queue cleanly on stop', async () => {
      let jobFinished = false
      queue.registerHandler('drain_task', async () => {
        await new Promise((r) => setTimeout(r, 60))
        jobFinished = true
        return true
      })

      const job = await queue.enqueue('drain_task', {})
      // Wait until job is in-flight running
      await vi.waitFor(async () => {
        const j = await queue.getJob(job.id)
        if (j?.status !== 'running') throw new Error('Not running yet')
      }, { timeout: 1000 })

      // Initiate graceful stop with drain timeout
      await queue.stop(500)

      expect(jobFinished).toBe(true)
      const stats = await queue.getStats()
      expect(stats.running).toBe(0)
    })
  })
})
