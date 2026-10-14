/**
 * Supabase Cloud Storage Adapter
 * 
 * Bridges into Supabase Storage buckets with graceful offline fallback.
 */

import { isSupabaseConfigured } from '../supabase/config'
import { createClient } from '../supabase/client'
import { sharedFileStorage } from './local'
import type {
  IFileStorageAdapter,
  StoredFileMetadata,
  StorageUploadOptions,
  StorageUploadResult,
  StorageDownloadResult,
  SignedUrlOptions,
} from './types'

export class SupabaseStorageAdapter implements IFileStorageAdapter {
  public name = 'supabase-storage'
  private bucket: string

  constructor(bucket: string = 'default') {
    this.bucket = bucket
  }

  async upload(
    data: Buffer | Uint8Array | string,
    filename: string,
    options: StorageUploadOptions = {}
  ): Promise<StorageUploadResult> {
    if (!isSupabaseConfigured()) {
      return sharedFileStorage.upload(data, filename, options)
    }

    try {
      const supabase = createClient()
      const path = options.path || filename
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data)

      const { data: uploadData, error } = await supabase.storage
        .from(this.bucket)
        .upload(path, buffer, {
          contentType: options.allowedMimeTypes?.[0] || 'application/octet-stream',
          upsert: true,
        })

      if (error || !uploadData) {
        return {
          success: false,
          error: error?.message || 'Supabase upload failed',
          errorCode: 'STORAGE_ERROR',
        }
      }

      const now = new Date().toISOString()
      const meta: StoredFileMetadata = {
        id: uploadData.id || path,
        name: filename,
        path: uploadData.path || path,
        mimeType: options.allowedMimeTypes?.[0] || 'application/octet-stream',
        sizeBytes: buffer.byteLength,
        isPublic: Boolean(options.isPublic),
        ownerId: options.ownerId,
        metadata: options.metadata,
        createdAt: now,
        updatedAt: now,
      }

      return { success: true, file: meta }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        errorCode: 'STORAGE_ERROR',
      }
    }
  }

  async download(path: string): Promise<StorageDownloadResult> {
    if (!isSupabaseConfigured()) {
      return sharedFileStorage.download(path)
    }

    try {
      const supabase = createClient()
      const { data, error } = await supabase.storage.from(this.bucket).download(path)

      if (error || !data) {
        return {
          success: false,
          error: error?.message || 'File not found',
          errorCode: 'FILE_NOT_FOUND',
        }
      }

      const arrayBuf = await data.arrayBuffer()
      return {
        success: true,
        data: Buffer.from(arrayBuf),
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        errorCode: 'STORAGE_ERROR',
      }
    }
  }

  async delete(path: string): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured()) {
      return sharedFileStorage.delete(path)
    }

    try {
      const supabase = createClient()
      const { error } = await supabase.storage.from(this.bucket).remove([path])
      return { success: !error, error: error?.message }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  async exists(path: string): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      return sharedFileStorage.exists(path)
    }

    const meta = await this.getMetadata(path)
    return Boolean(meta)
  }

  async getMetadata(path: string): Promise<StoredFileMetadata | null> {
    if (!isSupabaseConfigured()) {
      return sharedFileStorage.getMetadata(path)
    }

    try {
      const supabase = createClient()
      const { data, error } = await supabase.storage.from(this.bucket).list('', {
        search: path,
      })

      if (error || !data || data.length === 0) return null
      const item = data[0]

      return {
        id: item.id || path,
        name: item.name,
        path,
        mimeType: item.metadata?.mimetype || 'application/octet-stream',
        sizeBytes: item.metadata?.size || 0,
        isPublic: false,
        createdAt: item.created_at || new Date().toISOString(),
        updatedAt: item.updated_at || new Date().toISOString(),
      }
    } catch {
      return null
    }
  }

  async getSignedUrl(path: string, options: SignedUrlOptions = {}): Promise<string | null> {
    if (!isSupabaseConfigured()) {
      return sharedFileStorage.getSignedUrl(path, options)
    }

    try {
      const supabase = createClient()
      const { data, error } = await supabase.storage
        .from(this.bucket)
        .createSignedUrl(path, options.expiresInSeconds ?? 3600)

      if (error || !data) return null
      return data.signedUrl
    } catch {
      return null
    }
  }

  async list(prefix?: string): Promise<StoredFileMetadata[]> {
    if (!isSupabaseConfigured()) {
      return sharedFileStorage.list(prefix)
    }

    try {
      const supabase = createClient()
      const { data, error } = await supabase.storage.from(this.bucket).list(prefix || '')
      if (error || !data) return []

      return data.map((item) => ({
        id: item.id || item.name,
        name: item.name,
        path: prefix ? `${prefix}/${item.name}` : item.name,
        mimeType: item.metadata?.mimetype || 'application/octet-stream',
        sizeBytes: item.metadata?.size || 0,
        isPublic: false,
        createdAt: item.created_at || new Date().toISOString(),
        updatedAt: item.updated_at || new Date().toISOString(),
      }))
    } catch {
      return []
    }
  }
}
