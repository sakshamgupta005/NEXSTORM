import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { ToolRegistry } from '@/lib/agent/tools'
import {
  runAgentLoop,
  sanitizeContextForPrompt,
  sanitizePromptText,
  type AgentAction,
} from '@/lib/agent/loop'

describe('ToolRegistry', () => {
  it('registers tools and executes them with validated arguments', async () => {
    const registry = new ToolRegistry()

    registry.register({
      name: 'add_numbers',
      description: 'Adds two numbers',
      parameters: z.object({
        a: z.number(),
        b: z.number(),
      }),
      execute: ({ a, b }) => a + b,
    })

    expect(registry.hasTool('add_numbers')).toBe(true)
    expect(registry.listTools().length).toBe(1)

    const res = await registry.execute('add_numbers', { a: 5, b: 7 })
    expect(res.success).toBe(true)
    expect(res.data).toBe(12)
    expect(res.isReadOnly).toBe(true)
  })

  it('rejects invalid tool definitions and duplicate names', () => {
    const registry = new ToolRegistry()

    expect(() => registry.register(null as unknown as Parameters<typeof registry.register>[0])).toThrow('Tool must be an object.')
    expect(() =>
      registry.register({
        name: '',
        description: 'Test',
        parameters: z.object({}),
        execute: () => null,
      })
    ).toThrow('Tool must have a non-empty string name.')
    expect(() =>
      registry.register({
        name: 'test',
        description: 'Test',
        parameters: {} as unknown as z.ZodType<unknown>,
        execute: () => null,
      })
    ).toThrow('valid Zod schema')
    expect(() =>
      registry.register({
        name: 'test',
        description: 'Test',
        parameters: z.object({}),
        execute: null as unknown as () => null,
      })
    ).toThrow('provide an execute function')

    registry.register({
      name: 'unique_tool',
      description: 'Test',
      parameters: z.object({}),
      execute: () => null,
    })
    expect(() =>
      registry.register({
        name: 'unique_tool',
        description: 'Duplicate',
        parameters: z.object({}),
        execute: () => null,
      })
    ).toThrow("already registered")
  })

  it('safely rejects unknown tools without crashing', async () => {
    const registry = new ToolRegistry()
    const res = await registry.execute('unregistered_tool', {})

    expect(res.success).toBe(false)
    expect(res.errorCode).toBe('TOOL_NOT_FOUND')
    expect(res.error).toContain("is not registered or approved")
  })

  it('safely rejects invalid tool arguments without executing the tool function', async () => {
    let executed = false
    const registry = new ToolRegistry()

    registry.register({
      name: 'send_email',
      description: 'Sends an email',
      parameters: z.object({
        to: z.string().email(),
      }),
      execute: () => {
        executed = true
      },
    })

    const res = await registry.execute('send_email', { to: 'not-an-email' })

    expect(res.success).toBe(false)
    expect(res.errorCode).toBe('INVALID_ARGUMENTS')
    expect(res.error).toContain('Invalid tool arguments')
    expect(executed).toBe(false)
  })

  it('interrupts slow tool execution with per-tool timeout', async () => {
    const registry = new ToolRegistry()

    registry.register({
      name: 'slow_tool',
      description: 'Slow tool',
      parameters: z.object({}),
      timeoutMs: 40,
      execute: async () => {
        await new Promise((resolve) => setTimeout(resolve, 300))
        return 'done'
      },
    })

    const res = await registry.execute('slow_tool', {})

    expect(res.success).toBe(false)
    expect(res.errorCode).toBe('TIMEOUT')
    expect(res.error).toContain('timed out after 40ms')
  })

  it('supports cancelling tool execution via AbortSignal', async () => {
    const registry = new ToolRegistry()
    const controller = new AbortController()

    registry.register({
      name: 'cancellable_tool',
      description: 'Cancellable tool',
      parameters: z.object({}),
      execute: async () => 'done',
    })

    controller.abort()
    const res = await registry.execute('cancellable_tool', {}, { signal: controller.signal })

    expect(res.success).toBe(false)
    expect(res.errorCode).toBe('CANCELLED')
  })
})

describe('runAgentLoop', () => {
  it('completes multi-step reasoning and tool execution with final answer', async () => {
    const tools = new ToolRegistry()
    tools.register({
      name: 'get_weather',
      description: 'Gets current weather',
      parameters: z.object({ city: z.string() }),
      execute: ({ city }) => ({ city, temperature: 22, unit: 'celsius' }),
    })

    const mockActions: AgentAction[] = [
      {
        type: 'tool_call',
        toolName: 'get_weather',
        arguments: { city: 'Tokyo' },
        thought: 'I need to check the weather in Tokyo.',
      },
      {
        type: 'final_answer',
        answer: 'The weather in Tokyo is 22°C.',
        thought: 'I now have the weather data to answer.',
      },
    ]

    const result = await runAgentLoop({
      task: 'What is the weather in Tokyo?',
      tools,
      mockActions,
    })

    expect(result.success).toBe(true)
    expect(result.stopReason).toBe('completed')
    expect(result.finalAnswer).toBe('The weather in Tokyo is 22°C.')
    expect(result.totalIterations).toBe(2)
    expect(result.totalToolCalls).toBe(1)
    expect(result.iterations[0].action.type).toBe('tool_call')
    expect(result.iterations[0].toolResult?.success).toBe(true)
  })

  it('bounds execution when maximum iterations is reached', async () => {
    const tools = new ToolRegistry()
    tools.register({
      name: 'ping',
      description: 'Ping tool',
      parameters: z.object({}),
      execute: () => 'pong',
    })

    // Infinite tool calls
    const mockActions: AgentAction[] = Array(10).fill({
      type: 'tool_call',
      toolName: 'ping',
      arguments: {},
    })

    const result = await runAgentLoop({
      task: 'Keep pinging',
      tools,
      mockActions,
      maxIterations: 3,
    })

    expect(result.success).toBe(false)
    expect(result.stopReason).toBe('max_iterations')
    expect(result.totalIterations).toBe(3)
    expect(result.error).toContain('Exceeded maximum allowed iterations (3)')
  })

  it('bounds execution when maximum tool calls is reached', async () => {
    const tools = new ToolRegistry()
    tools.register({
      name: 'ping',
      description: 'Ping tool',
      parameters: z.object({}),
      execute: () => 'pong',
    })

    const mockActions: AgentAction[] = [
      { type: 'tool_call', toolName: 'ping', arguments: {} },
      { type: 'tool_call', toolName: 'ping', arguments: {} },
      { type: 'tool_call', toolName: 'ping', arguments: {} },
    ]

    const result = await runAgentLoop({
      task: 'Ping multiple times',
      tools,
      mockActions,
      maxToolCalls: 2,
    })

    expect(result.success).toBe(false)
    expect(result.stopReason).toBe('max_tool_calls')
    expect(result.totalToolCalls).toBe(2)
    expect(result.error).toContain('Exceeded maximum allowed tool calls (2)')
  })

  it('halts with timeout stop reason when overall execution exceeds budget', async () => {
    const tools = new ToolRegistry()
    tools.register({
      name: 'slow_op',
      description: 'Slow operation',
      parameters: z.object({}),
      execute: async () => {
        await new Promise((resolve) => setTimeout(resolve, 300))
        return 'ok'
      },
    })

    const mockActions: AgentAction[] = [
      { type: 'tool_call', toolName: 'slow_op', arguments: {} },
    ]

    const result = await runAgentLoop({
      task: 'Run slow task',
      tools,
      mockActions,
      timeoutMs: 50,
    })

    expect(result.success).toBe(false)
    expect(result.stopReason).toBe('timeout')
    expect(result.error).toContain('timed out after 50ms')
  })

  it('halts with cancelled stop reason when signal is aborted', async () => {
    const tools = new ToolRegistry()
    const controller = new AbortController()

    controller.abort()

    const result = await runAgentLoop({
      task: 'Cancelled task',
      tools,
      mockActions: [{ type: 'final_answer', answer: 'Should not run' }],
      signal: controller.signal,
    })

    expect(result.success).toBe(false)
    expect(result.stopReason).toBe('cancelled')
    expect(result.error).toContain('cancelled by signal')
  })

  it('protects side-effecting tools from automatic retry on failure', async () => {
    const tools = new ToolRegistry()
    let paymentExecutionCount = 0

    tools.register({
      name: 'process_payment',
      description: 'Charges a card',
      isReadOnly: false, // Mutating side effect
      parameters: z.object({ amount: z.number() }),
      execute: () => {
        paymentExecutionCount++
        throw new Error('Payment gateway timeout')
      },
    })

    const mockActions: AgentAction[] = [
      {
        type: 'tool_call',
        toolName: 'process_payment',
        arguments: { amount: 100 },
      },
      {
        type: 'tool_call',
        toolName: 'process_payment',
        arguments: { amount: 100 },
      },
      {
        type: 'final_answer',
        answer: 'Failed gracefully.',
      },
    ]

    const result = await runAgentLoop({
      task: 'Charge user',
      tools,
      mockActions,
      canRetrySideEffects: false, // Default safety mode
    })

    expect(result.success).toBe(true) // completed final_answer after receiving blocked feedback
    expect(paymentExecutionCount).toBe(1) // Executed only ONCE, second attempt blocked before execution
    expect(result.iterations[1].toolResult?.error).toContain('Automatic retry of side-effecting tool')
  })

  it('allows retrying side-effecting tools when explicitly configured', async () => {
    const tools = new ToolRegistry()
    let paymentExecutionCount = 0

    tools.register({
      name: 'process_payment',
      description: 'Charges a card',
      isReadOnly: false,
      parameters: z.object({ amount: z.number() }),
      execute: () => {
        paymentExecutionCount++
        throw new Error('Payment gateway error')
      },
    })

    const mockActions: AgentAction[] = [
      { type: 'tool_call', toolName: 'process_payment', arguments: { amount: 100 } },
      { type: 'tool_call', toolName: 'process_payment', arguments: { amount: 100 } },
      { type: 'final_answer', answer: 'Done' },
    ]

    await runAgentLoop({
      task: 'Charge user with retry enabled',
      tools,
      mockActions,
      canRetrySideEffects: true,
    })

    expect(paymentExecutionCount).toBe(2)
  })

  it('sanitizes secrets from prompt context and bearer tokens', () => {
    const context = {
      user: 'alice',
      api_key: 'sk-secret-123',
      nested: {
        password: 'super-password',
        auth_token: 'jwt-token-abc',
        profile: 'engineer',
      },
    }

    const sanitized = sanitizeContextForPrompt(context)
    expect(sanitized.api_key).toBe('[REDACTED]')
    const nested = sanitized.nested as Record<string, unknown>
    expect(nested.password).toBe('[REDACTED]')
    expect(nested.auth_token).toBe('[REDACTED]')
    expect(nested.profile).toBe('engineer')
    expect(sanitized.user).toBe('alice')

    const promptText = 'Authorization header: Bearer abcdef123456789'
    const scrubbed = sanitizePromptText(promptText)
    expect(scrubbed).toBe('Authorization header: Bearer [REDACTED]')
  })
})
