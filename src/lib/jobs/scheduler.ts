/**
 * Recurring Job Scheduler
 * 
 * Capabilities:
 * - Recurring jobs via fixed millisecond intervals or standard 5-field cron patterns
 * - Duplicate registration prevention by unique schedule ID
 * - Time calculations matching next execution boundaries
 * - Pause, resume, update, and cancellation lifecycles
 * - Automatic dispatch to any IJobQueue provider
 */

import type { IJobQueue, RecurringJobSchedule, EnqueueOptions } from './types'

export interface RegisterRecurringOptions<TData = unknown> {
  id: string
  name: string
  data: TData
  intervalMs?: number
  cronExpression?: string
  options?: EnqueueOptions
}

export class JobScheduler {
  private schedules = new Map<string, RecurringJobSchedule<unknown>>()
  private targetQueue: IJobQueue | null = null
  private timer: NodeJS.Timeout | null = null
  private isRunning = false
  private tickIntervalMs = 500

  constructor(targetQueue?: IJobQueue, tickIntervalMs = 500) {
    this.targetQueue = targetQueue ?? null
    this.tickIntervalMs = Math.max(100, tickIntervalMs)
  }

  public setQueue(queue: IJobQueue): void {
    this.targetQueue = queue
  }

  public registerRecurring<TData = unknown>(
    options: RegisterRecurringOptions<TData>
  ): RecurringJobSchedule<TData> {
    if (!options.id || typeof options.id !== 'string') {
      throw new Error('Recurring schedule requires a non-empty string id')
    }
    if (!options.name || typeof options.name !== 'string') {
      throw new Error('Recurring schedule requires a valid job name')
    }
    if (!options.intervalMs && !options.cronExpression) {
      throw new Error('Recurring schedule requires either intervalMs or cronExpression')
    }

    if (this.schedules.has(options.id)) {
      throw new Error(`Recurring job with ID '${options.id}' is already registered`)
    }

    const now = Date.now()
    const nextRunAt = this.calculateNextRun(options.intervalMs, options.cronExpression, now)

    const schedule: RecurringJobSchedule<TData> = {
      id: options.id,
      name: options.name,
      data: options.data,
      intervalMs: options.intervalMs,
      cronExpression: options.cronExpression,
      options: options.options,
      nextRunAt,
      enabled: true,
    }

    this.schedules.set(options.id, schedule)
    return schedule
  }

  public removeRecurring(id: string): boolean {
    return this.schedules.delete(id)
  }

  public pauseRecurring(id: string): boolean {
    const item = this.schedules.get(id)
    if (!item) return false
    item.enabled = false
    return true
  }

  public resumeRecurring(id: string): boolean {
    const item = this.schedules.get(id)
    if (!item) return false
    item.enabled = true
    item.nextRunAt = this.calculateNextRun(item.intervalMs, item.cronExpression, Date.now())
    return true
  }

  public getRecurring(id: string): RecurringJobSchedule<unknown> | null {
    return this.schedules.get(id) ?? null
  }

  public listRecurring(): RecurringJobSchedule<unknown>[] {
    return Array.from(this.schedules.values())
  }

  public start(): void {
    if (this.isRunning) return
    this.isRunning = true
    this.scheduleNextTick()
  }

  public stop(): void {
    this.isRunning = false
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  public async tick(): Promise<number> {
    if (!this.targetQueue) return 0
    const now = Date.now()
    let dispatched = 0

    for (const schedule of this.schedules.values()) {
      if (!schedule.enabled) continue

      if (schedule.nextRunAt <= now) {
        // Enqueue into destination queue
        await this.targetQueue.enqueue(schedule.name, schedule.data, {
          ...schedule.options,
          // Generate deterministic run idempotency key for this scheduled tick
          idempotencyKey: `${schedule.id}_${schedule.nextRunAt}`,
        })

        schedule.lastRunAt = now
        schedule.nextRunAt = this.calculateNextRun(
          schedule.intervalMs,
          schedule.cronExpression,
          now
        )
        dispatched++
      }
    }

    return dispatched
  }

  private scheduleNextTick(): void {
    if (!this.isRunning) return
    this.timer = setTimeout(async () => {
      try {
        await this.tick()
      } catch {
        // Ticks must not throw
      }
      this.scheduleNextTick()
    }, this.tickIntervalMs)
  }

  public calculateNextRun(
    intervalMs?: number,
    cronExpression?: string,
    fromTimestamp = Date.now()
  ): number {
    if (intervalMs && intervalMs > 0) {
      return fromTimestamp + intervalMs
    }

    if (cronExpression) {
      return this.computeNextCronRun(cronExpression, fromTimestamp)
    }

    return fromTimestamp + 60_000
  }

  /**
   * Deterministic 5-field cron parser: minute, hour, day-of-month, month, day-of-week
   */
  public computeNextCronRun(cron: string, fromTimestamp: number): number {
    const parts = cron.trim().split(/\s+/)
    if (parts.length !== 5) {
      // Fallback to 1 minute if malformed
      return fromTimestamp + 60_000
    }

    const [minStr, hourStr, domStr, monthStr, dowStr] = parts
    const current = new Date(fromTimestamp)
    // Advance at least 1 minute forward so we don't trigger the exact current minute again
    current.setSeconds(0, 0)
    current.setMinutes(current.getMinutes() + 1)

    // Search forward up to 365 days (max 525,600 minutes)
    for (let i = 0; i < 525600; i++) {
      const min = current.getMinutes()
      const hour = current.getHours()
      const dom = current.getDate()
      const month = current.getMonth() + 1 // 1-12
      const dow = current.getDay() // 0-6

      if (
        this.matchCronPart(minStr, min) &&
        this.matchCronPart(hourStr, hour) &&
        this.matchCronPart(domStr, dom) &&
        this.matchCronPart(monthStr, month) &&
        this.matchCronPart(dowStr, dow)
      ) {
        return current.getTime()
      }

      current.setMinutes(current.getMinutes() + 1)
    }

    return fromTimestamp + 60_000
  }

  private matchCronPart(pattern: string, value: number): boolean {
    if (pattern === '*') return true

    if (pattern.startsWith('*/')) {
      const step = parseInt(pattern.slice(2), 10)
      if (isNaN(step) || step <= 0) return true
      return value % step === 0
    }

    const subparts = pattern.split(',')
    for (const sub of subparts) {
      const num = parseInt(sub.trim(), 10)
      if (!isNaN(num) && num === value) return true
    }

    return false
  }
}

/**
 * Shared singleton scheduler
 */
export const sharedJobScheduler = new JobScheduler()
