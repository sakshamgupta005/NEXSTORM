/**
 * Safe Notification Templates & Rendering Engine
 * 
 * Capabilities:
 * - Named notification template registration
 * - Variable substitution (e.g. {{name}}, {{actionUrl}})
 * - HTML escaping for security to prevent XSS in email and in-app views
 * - Automatic plain-text fallback generation
 * - Missing variable validation
 */

import type { NotificationTemplate, NotificationPayload } from './types'

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<\/?(?:b|strong|i|em|u|span|small|code|a)\b[^>]*>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+([.,!?:;])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

export class NotificationTemplateRegistry {
  private templates = new Map<string, NotificationTemplate>()

  constructor() {
    this.registerStandardTemplates()
  }

  public registerTemplate(template: NotificationTemplate): void {
    if (!template.id) {
      throw new Error('Template must have a unique ID')
    }
    this.templates.set(template.id, template)
  }

  public getTemplate(id: string): NotificationTemplate | undefined {
    return this.templates.get(id)
  }

  public render(
    templateId: string,
    variables: Record<string, unknown> = {}
  ): { title: string; body: string; html?: string } {
    const template = this.templates.get(templateId)
    if (!template) {
      throw new Error(`Notification template '${templateId}' not found`)
    }

    // Validate required variables
    if (template.requiredVariables) {
      const missing = template.requiredVariables.filter((v) => variables[v] === undefined)
      if (missing.length > 0) {
        throw new Error(
          `Template '${templateId}' is missing required variables: ${missing.join(', ')}`
        )
      }
    }

    const title = this.interpolate(template.titleTemplate, variables, false)
    const body = this.interpolate(template.bodyTemplate, variables, false)
    const html = template.htmlTemplate
      ? this.interpolate(template.htmlTemplate, variables, true)
      : undefined

    return { title, body, html }
  }

  public applyToPayload(payload: NotificationPayload): NotificationPayload {
    if (!payload.templateId) {
      return payload
    }

    const rendered = this.render(payload.templateId, payload.variables || {})
    return {
      ...payload,
      title: rendered.title || payload.title,
      body: rendered.body || payload.body,
      html: rendered.html || payload.html,
    }
  }

  private interpolate(
    text: string,
    variables: Record<string, unknown>,
    isHtml: boolean
  ): string {
    return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
      const val = variables[key]
      if (val === undefined || val === null) {
        return ''
      }
      const strVal = String(val)
      return isHtml ? escapeHtml(strVal) : strVal
    })
  }

  private registerStandardTemplates(): void {
    this.registerTemplate({
      id: 'welcome_email',
      name: 'Welcome Email',
      category: 'transactional',
      titleTemplate: 'Welcome to Hackathon Starter, {{name}}!',
      bodyTemplate: 'Hi {{name}}, your account is now ready. Start building at {{appUrl}}.',
      htmlTemplate: '<h1>Welcome, {{name}}!</h1><p>Your account is ready. <a href="{{appUrl}}">Get Started</a>.</p>',
      requiredVariables: ['name', 'appUrl'],
    })

    this.registerTemplate({
      id: 'security_alert',
      name: 'Security Alert',
      category: 'security',
      titleTemplate: 'Security Alert: New login detected',
      bodyTemplate: 'A new login occurred on your account from IP {{ip}} at {{time}}.',
      htmlTemplate: '<h2>Security Notification</h2><p>A new login occurred from IP <code>{{ip}}</code> at {{time}}.</p>',
      requiredVariables: ['ip', 'time'],
    })

    this.registerTemplate({
      id: 'magic_link',
      name: 'Magic Link Sign-In',
      category: 'security',
      titleTemplate: 'Your sign-in link',
      bodyTemplate: 'Click here to sign in: {{actionUrl}} (Valid for 15 minutes)',
      htmlTemplate: '<p>Click below to sign in:</p><a href="{{actionUrl}}">Sign In</a><p><small>Valid for 15 minutes.</small></p>',
      requiredVariables: ['actionUrl'],
    })
  }
}

export const sharedTemplateRegistry = new NotificationTemplateRegistry()
