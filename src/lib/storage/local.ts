/**
 * Local / In-Memory File Storage Adapter
 * 
 * Provides:
 * - High-speed, 100% offline file storage for local dev and automated tests
 * - Buffer storage and retrieval with metadata indexing
 * - Simulated signed URLs with cryptographic token signatures
 * - Size and MIME validation with anti-traversal security
 */

import { randomBytes, createHmac } from 'node:crypto'
import {
  sanitizeStoragePath,
  generateSafeStoragePath,
  validateStorageFile,
} from './security'
import type {
  IFileStorageAdapter,
  StoredFileMetadata,
  StorageUploadOptions,
  StorageUploadResult,
  StorageDownloadResult,
  SignedUrlOptions,
} from './types'

const SIGNING_SECRET = 'local_storage_secret_key_2026'

function guessMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'txt': return 'text/plain'
    case 'json': return 'application/json'
    case 'pdf': return 'application/pdf'
    case 'png': return 'image/png'
    case 'jpg':
    case 'jpeg': return 'image/jpeg'
    case 'webp': return 'image/webp'
    case 'csv': return 'text/csv'
    default: return 'application/octet-stream'
  }
}

export class LocalStorageAdapter implements IFileStorageAdapter {
  public name = 'local-storage'
  private files = new Map<string, Buffer>()
  private metadata = new Map<string, StoredFileMetadata>()

  async upload(
    data: Buffer | Uint8Array | string,
    filename: string,
    options: StorageUploadOptions = {}
  ): Promise<StorageUploadResult> {
    const buffer = Buffer.isBuffer(data)
      ? data
      : data instanceof Uint8Array
      ? Buffer.from(data)
      : Buffer.from(data, 'utf8')

    const sizeBytes = buffer.byteLength
    const mimeType = options.contentType || options.allowedMimeTypes?.[0] || guessMimeType(filename)

    // 1. Validate file size and MIME
    const validation = validateStorageFile(filename, sizeBytes, mimeType, {
      maxSizeInBytes: options.maxSizeInBytes,
      allowedMimeTypes: options.allowedMimeTypes,
    })

    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
        errorCode: validation.error?.includes('size') ? 'FILE_TOO_LARGE' : 'UNSUPPORTED_MEDIA_TYPE',
      }
    }

    // 2. Resolve safe storage path
    let targetPath: string
    if (options.path) {
      const sanitized = sanitizeStoragePath(options.path)
      if (!sanitized.valid || !sanitized.path) {
        return {
          success: false,
          error: sanitized.error,
          errorCode: 'INVALID_PATH',
        }
      }
      targetPath = sanitized.path
    } else {
      targetPath = generateSafeStoragePath(filename)
    }

    const now = new Date().toISOString()
    const fileId = `file_${randomBytes(8).toString('hex')}`

    const meta: StoredFileMetadata = {
      id: fileId,
      name: filename,
      path: targetPath,
      mimeType,
      sizeBytes,
      isPublic: Boolean(options.isPublic),
      ownerId: options.ownerId,
      metadata: options.metadata,
      createdAt: now,
      updatedAt: now,
    }

    this.files.set(targetPath, buffer)
    this.metadata.set(targetPath, meta)

    return {
      success: true,
      file: meta,
    }
  }

  async download(path: string): Promise<StorageDownloadResult> {
    const sanitized = sanitizeStoragePath(path)
    if (!sanitized.valid || !sanitized.path) {
      return {
        success: false,
        error: sanitized.error,
        errorCode: 'INVALID_PATH',
      }
    }

    const buffer = this.files.get(sanitized.path)
    const meta = this.metadata.get(sanitized.path)

    if (!buffer || !meta) {
      return {
        success: false,
        error: `File not found at path "${sanitized.path}"`,
        errorCode: 'FILE_NOT_FOUND',
      }
    }

    return {
      success: true,
      data: Buffer.from(buffer),
      metadata: meta,
    }
  }

  async delete(path: string): Promise<{ success: boolean; error?: string }> {
    const sanitized = sanitizeStoragePath(path)
    if (!sanitized.valid || !sanitized.path) {
      return { success: false, error: sanitized.error }
    }

    this.files.delete(sanitized.path)
    this.metadata.delete(sanitized.path)
    return { success: true }
  }

  async exists(path: string): Promise<boolean> {
    const sanitized = sanitizeStoragePath(path)
    if (!sanitized.valid || !sanitized.path) return false
    return this.files.has(sanitized.path)
  }

  async getMetadata(path: string): Promise<StoredFileMetadata | null> {
    const sanitized = sanitizeStoragePath(path)
    if (!sanitized.valid || !sanitized.path) return null
    return this.metadata.get(sanitized.path) || null
  }

  async getSignedUrl(path: string, options: SignedUrlOptions = {}): Promise<string | null> {
    const sanitized = sanitizeStoragePath(path)
    if (!sanitized.valid || !sanitized.path) return null
    if (!this.files.has(sanitized.path)) return null

    const expiresSeconds = options.expiresInSeconds ?? 3600
    const expiresAt = Math.floor(Date.now() / 1000) + expiresSeconds
    const operation = options.operation || 'read'

    const signaturePayload = `${sanitized.path}:${operation}:${expiresAt}`
    const signature = createHmac('sha256', SIGNING_SECRET).update(signaturePayload).digest('hex')

    return `/api/storage/file?path=${encodeURIComponent(sanitized.path)}&expires=${expiresAt}&sig=${signature}`
  }

  async list(prefix?: string): Promise<StoredFileMetadata[]> {
    const all = Array.from(this.metadata.values())
    if (!prefix) return all

    const cleanPrefix = prefix.replace(/^\/+|\/+$/g, '')
    return all.filter((f) => f.path.startsWith(cleanPrefix))
  }

  clear(): void {
    this.files.clear()
    this.metadata.clear()
  }

  get size(): number {
    return this.files.size
  }
}

export const sharedFileStorage = new LocalStorageAdapter()
