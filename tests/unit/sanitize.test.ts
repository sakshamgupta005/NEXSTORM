import { describe, it, expect } from 'vitest'
import {
  escapeHtml,
  stripHtmlTags,
  sanitizeFileName,
  sanitizePlainText,
} from '@/lib/security/sanitize'

describe('Sanitization Utilities', () => {
  it('escapes unsafe HTML characters to prevent XSS injection', () => {
    const raw = `<script>alert("XSS & 'steal'")</script>`
    const escaped = escapeHtml(raw)
    expect(escaped).toBe('&lt;script&gt;alert(&quot;XSS &amp; &#039;steal&#039;&quot;)&lt;/script&gt;')
  })

  it('strips HTML tags completely from user input', () => {
    const raw = '<p>Hello <b>World</b>! <img src="x" onerror="alert(1)" /></p>'
    const stripped = stripHtmlTags(raw)
    expect(stripped).toBe('Hello World!')
  })

  it('sanitizes filenames to prevent path traversal and null-byte injection', () => {
    expect(sanitizeFileName('../../etc/passwd')).toBe('passwd')
    expect(sanitizeFileName('..\\..\\windows\\system32\\cmd.exe')).toBe('cmd.exe')
    expect(sanitizeFileName('test\x00file.png')).toBe('testfile.png')
    expect(sanitizeFileName('.env.local')).toBe('file_env.local')
    expect(sanitizeFileName('normal-document_v1.pdf')).toBe('normal-document_v1.pdf')
  })

  it('strips non-printable ASCII control characters from plain text', () => {
    const textWithControl = 'Hello\x00\x08World\x1F!'
    expect(sanitizePlainText(textWithControl)).toBe('HelloWorld!')
  })
})
