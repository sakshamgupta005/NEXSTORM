/**
 * Core type definitions for Accessibility (a11y) toolkit.
 */

export type LiveAnnouncementPriority = 'polite' | 'assertive'

export interface LiveAnnouncement {
  id: string
  message: string
  priority: LiveAnnouncementPriority
}

export interface AnnouncerContextValue {
  announce: (message: string, priority?: LiveAnnouncementPriority) => void
  clear: () => void
}

export interface A11yViolationNode {
  html: string
  target: string[]
  failureSummary?: string
}

export interface A11yViolation {
  id: string
  impact?: 'minor' | 'moderate' | 'serious' | 'critical'
  description: string
  help: string
  helpUrl: string
  nodes: A11yViolationNode[]
}

export interface A11yAuditResult {
  passes: boolean
  violations: A11yViolation[]
  totalViolations: number
  summary: string
}
