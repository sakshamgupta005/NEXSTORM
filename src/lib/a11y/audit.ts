/**
 * Automated accessibility auditing adapter wrapping axe-core.
 */

import { A11yAuditResult, A11yViolation } from './types'

export interface A11yAuditOptions {
  rules?: string[]
  includeWarnings?: boolean
}

/**
 * Runs an accessibility audit against an HTML element or document.
 */
export async function runA11yAudit(
  element?: HTMLElement | Document | null,
  options: A11yAuditOptions = {}
): Promise<A11yAuditResult> {
  const target =
    element ||
    (typeof document !== 'undefined' ? document.body : null)

  if (!target) {
    return {
      passes: true,
      violations: [],
      totalViolations: 0,
      summary: 'No DOM element target available for accessibility audit.',
    }
  }

  try {
    // Dynamic import for axe-core
    const axeModule = await import('axe-core')
    const axe = axeModule.default || axeModule

    const runOptions: Record<string, unknown> = {
      runOnly: options.rules ? { type: 'rule', values: options.rules } : undefined,
    }

    const results = await axe.run(target as HTMLElement, runOptions)

    const violations: A11yViolation[] = (results.violations || []).map((v) => ({
      id: v.id,
      impact: v.impact as A11yViolation['impact'],
      description: v.description,
      help: v.help,
      helpUrl: v.helpUrl,
      nodes: (v.nodes || []).map((node) => ({
        html: node.html,
        target: node.target as string[],
        failureSummary: node.failureSummary,
      })),
    }))

    const passes = violations.length === 0
    const summary = passes
      ? `A11y audit passed: 0 violations detected against WCAG standards.`
      : `A11y audit found ${violations.length} violation(s): ${violations.map((v) => v.id).join(', ')}`

    return {
      passes,
      violations,
      totalViolations: violations.length,
      summary,
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    return {
      passes: false,
      violations: [
        {
          id: 'axe-execution-error',
          impact: 'serious',
          description: `Failed to execute axe-core audit: ${errorMsg}`,
          help: 'Ensure axe-core is running inside a DOM-capable environment.',
          helpUrl: 'https://github.com/dequelabs/axe-core',
          nodes: [],
        },
      ],
      totalViolations: 1,
      summary: `A11y audit execution failed: ${errorMsg}`,
    }
  }
}
