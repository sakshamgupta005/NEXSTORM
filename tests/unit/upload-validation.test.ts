import { describe, it, expect } from 'vitest'
import { validateUploadFile } from '@/lib/security/upload'

describe('File Upload Validation', () => {
  it('accepts valid image upload within size limits', () => {
    const file = {
      name: 'avatar.png',
      size: 1024 * 500, // 500KB
      type: 'image/png',
    }

    const result = validateUploadFile(file)
    expect(result.valid).toBe(true)
    expect(result.sanitizedName).toBe('avatar.png')
  })

  it('rejects files exceeding the maximum size limit', () => {
    const file = {
      name: 'huge-video.mp4',
      size: 10 * 1024 * 1024, // 10MB
      type: 'application/pdf',
    }

    const result = validateUploadFile(file, { maxSizeInBytes: 2 * 1024 * 1024 })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('exceeds maximum allowed size')
  })

  it('rejects dangerous executable and script file extensions', () => {
    const dangerousFiles = [
      { name: 'payload.exe', size: 1000, type: 'application/octet-stream' },
      { name: 'script.sh', size: 1000, type: 'text/plain' },
      { name: 'malware.php', size: 1000, type: 'text/plain' },
      { name: 'vector.svg', size: 1000, type: 'image/svg+xml' },
    ]

    for (const f of dangerousFiles) {
      const res = validateUploadFile(f)
      expect(res.valid).toBe(false)
      expect(res.error).toContain('is prohibited for security reasons')
    }
  })

  it('rejects unsupported MIME types when type is not in allowlist', () => {
    const file = {
      name: 'audio.wav',
      size: 1000,
      type: 'audio/wav',
    }

    const result = validateUploadFile(file, { allowedMimeTypes: ['image/png', 'image/jpeg'] })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('is not supported')
  })
})
