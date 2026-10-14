/**
 * File Storage Interface & Contract Types
 * 
 * Inspired by MinIO, AWS S3, and Supabase Storage patterns.
 */

export interface StoredFileMetadata {
  id: string
  name: string
  path: string
  mimeType: string
  sizeBytes: number
  isPublic: boolean
  createdAt: string
  updatedAt: string
  ownerId?: string
  metadata?: Record<string, unknown>
}

export interface StorageUploadOptions {
  path?: string
  contentType?: string
  isPublic?: boolean
  maxSizeInBytes?: number
  allowedMimeTypes?: string[]
  ownerId?: string
  metadata?: Record<string, unknown>
}

export interface SignedUrlOptions {
  expiresInSeconds?: number
  operation?: 'read' | 'write'
}

export type StorageErrorCode =
  | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'INVALID_PATH'
  | 'FILE_NOT_FOUND'
  | 'FORBIDDEN'
  | 'STORAGE_ERROR'
  | 'NOT_CONFIGURED'

export interface StorageUploadResult {
  success: boolean
  file?: StoredFileMetadata
  error?: string
  errorCode?: StorageErrorCode
}

export interface StorageDownloadResult {
  success: boolean
  data?: Buffer
  metadata?: StoredFileMetadata
  error?: string
  errorCode?: StorageErrorCode
}

export interface IFileStorageAdapter {
  name: string
  upload(
    data: Buffer | Uint8Array | string,
    filename: string,
    options?: StorageUploadOptions
  ): Promise<StorageUploadResult>
  download(path: string): Promise<StorageDownloadResult>
  delete(path: string): Promise<{ success: boolean; error?: string }>
  exists(path: string): Promise<boolean>
  getMetadata(path: string): Promise<StoredFileMetadata | null>
  getSignedUrl(path: string, options?: SignedUrlOptions): Promise<string | null>
  list(prefix?: string): Promise<StoredFileMetadata[]>
}
