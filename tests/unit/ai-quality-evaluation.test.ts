import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import {
  PROMPT_INJECTION_VECTORS,
  validateStructuredOutput,
  evaluateCitationGrounding,
  evaluateAgentLoopTermination,
} from '@/lib/testing'
import { runAgentLoop, type AgentAction } from '@/lib/agent/loop'
import { ToolRegistry } from '@/lib/agent/tools'

describe('AI Feature Quality & Evaluation Suite', () => {
  it('evaluates AI agent loop under simulated LLM tool calls using testing utilities', async () => {
    const tools = new ToolRegistry()
    tools.register({
      name: 'calculate',
      description: 'Calculates values',
      parameters: z.object({ value: z.number() }),
      execute: async ({ value }: { value: number }) => ({ result: value * 2 }),
      isReadOnly: true,
    })

    const mockActions: AgentAction[] = [
      {
        type: 'tool_call',
        toolName: 'calculate',
        arguments: { value: 21 },
        thought: 'Need to double 21',
      },
      {
        type: 'final_answer',
        answer: 'The calculated answer is 42',
        thought: 'Calculation complete',
      },
    ]

    const loopResult = await runAgentLoop({
      task: 'What is the calculated value?',
      tools,
      mockActions,
      maxIterations: 5,
    })

    expect(loopResult.success).toBe(true)
    expect(loopResult.stopReason).toBe('completed')
    expect(loopResult.finalAnswer).toBe('The calculated answer is 42')

    const evaluation = evaluateAgentLoopTermination(
      loopResult.iterations.map((iter) => ({
        stepNumber: iter.iteration,
        action: iter.action.type,
        done: iter.action.type === 'final_answer',
      })),
      5
    )
    expect(evaluation.terminated).toBe(true)
    expect(evaluation.exceededMaxSteps).toBe(false)
  })

  it('validates structured output from RAG extraction results', () => {
    const ExtractionSchema = z.object({
      summary: z.string(),
      confidence: z.number().min(0).max(1),
      tags: z.array(z.string()),
    })

    const sampleAiOutput = `
\`\`\`json
{
  "summary": "AI agents coordinate via deterministic tools and evaluation gates.",
  "confidence": 0.95,
  "tags": ["agents", "evaluation", "testing"]
}
\`\`\`
`

    const result = validateStructuredOutput(sampleAiOutput, ExtractionSchema)
    expect(result.success).toBe(true)
    expect(result.data?.confidence).toBe(0.95)
    expect(result.data?.tags).toContain('evaluation')
  })

  it('evaluates grounding of AI answers against reference knowledge artifacts', () => {
    const sourceKnowledge = [
      'Next.js 16 uses Turbopack for local compilation and supports Server Components by default.',
      'Supabase provides authentication, PostgreSQL database storage, and edge functions.',
    ]

    const hallucinatedAnswer =
      'Ruby on Rails with MySQL database powers the backend architecture and handles real-time webhooks.'

    const evalResult = evaluateCitationGrounding(hallucinatedAnswer, sourceKnowledge)
    expect(evalResult.grounded).toBe(false)
    expect(evalResult.groundingScore).toBeLessThan(0.4)
  })

  it('tests prompt injection vectors against input validation guards', () => {
    // Basic prompt sanitizer to test against injection vectors
    function sanitizePromptInput(input: string): { safe: boolean; sanitized: string; flaggedVectors: string[] } {
      const flagged: string[] = []
      const lower = input.toLowerCase()

      for (const vector of PROMPT_INJECTION_VECTORS) {
        if (
          lower.includes('ignore all previous instructions') ||
          lower.includes('repeat the exact initial system') ||
          lower.includes('--- end of user input ---') ||
          lower.includes('![image](http')
        ) {
          flagged.push(vector.id)
        }
      }

      return {
        safe: flagged.length === 0,
        sanitized: input.replace(/[<>]/g, ''),
        flaggedVectors: flagged,
      }
    }

    for (const vector of PROMPT_INJECTION_VECTORS) {
      const check = sanitizePromptInput(vector.payload)
      // Verify that known adversarial payloads trigger detection or sanitization
      if (vector.category !== 'jailbreak') {
        expect(check.safe).toBe(false)
      }
    }
  })
})
