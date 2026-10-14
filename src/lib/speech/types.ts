/**
 * Reusable Speech & Voice Toolkit — Types & Contracts
 * 
 * References:
 * - Faster Whisper: High-performance STT inference (MIT)
 * - OpenAI Whisper: Speech recognition standard (MIT)
 * - Transformers.js: Browser-side & lightweight model pipelines (Apache-2.0)
 * - Kokoro: Ultra-lightweight open-source TTS (Apache-2.0)
 * - Piper: Fast local neural text-to-speech (MIT)
 */

export type AudioFormat = 'wav' | 'mp3' | 'ogg' | 'webm' | 'm4a' | 'flac'

export type STTProvider = 'mock' | 'whisper-service' | 'openai' | 'groq'

export type TTSProvider =
  | 'mock'
  | 'browser'
  | 'openai'
  | 'elevenlabs'
  | 'kokoro-service'
  | 'piper-service'

export type SpeechErrorCode =
  | 'EMPTY_AUDIO'
  | 'OVERSIZED_AUDIO'
  | 'UNSUPPORTED_FORMAT'
  | 'EMPTY_TEXT'
  | 'OVERSIZED_TEXT'
  | 'NOT_CONFIGURED'
  | 'PERMISSION_DENIED'
  | 'MICROPHONE_UNAVAILABLE'
  | 'TIMEOUT'
  | 'CANCELLED'
  | 'PROVIDER_ERROR'

export interface SpeechErrorDetail {
  code: SpeechErrorCode
  message: string
  details?: Record<string, unknown>
  recoverable?: boolean
}

// ============================================================================
// Speech-to-Text (STT) Contracts
// ============================================================================

export interface SpeechSegment {
  start: number
  end: number
  text: string
  confidence?: number
}

export interface TranscribeInput {
  /** Raw base64 audio data or data URI */
  audioBase64?: string
  /** Audio URL or local path */
  audioUrl?: string
  /** Audio buffer or Uint8Array */
  audioBuffer?: Uint8Array
  /** Explicit format or MIME type hint (e.g. 'audio/webm', 'wav') */
  format?: AudioFormat | string
  /** Optional language hint (e.g. 'en', 'es', 'fr') */
  language?: string
  /** Optional prompt or vocabulary context to guide the model */
  prompt?: string
  /** File size in bytes if known */
  byteLength?: number
}

export interface STTOptions {
  provider?: STTProvider
  apiKey?: string
  serviceUrl?: string
  maxSizeBytes?: number
  timeoutMs?: number
  signal?: AbortSignal
}

export interface TranscribeResult {
  success: boolean
  text: string
  language?: string
  duration?: number
  segments?: SpeechSegment[]
  provider: STTProvider
  latencyMs: number
  error?: string
  errorDetail?: SpeechErrorDetail
}

// ============================================================================
// Text-to-Speech (TTS) Contracts
// ============================================================================

export interface SynthesizeInput {
  text: string
  voice?: string
  language?: string
  speed?: number
  format?: 'mp3' | 'wav' | 'opus' | 'aac'
}

export interface TTSOptions {
  provider?: TTSProvider
  apiKey?: string
  serviceUrl?: string
  maxChars?: number
  timeoutMs?: number
  signal?: AbortSignal
}

export interface SynthesizeResult {
  success: boolean
  /** Base64-encoded audio or data URI */
  audioBase64?: string
  /** Playable audio URL if hosted or generated as object URL */
  audioUrl?: string
  format: string
  durationEstimateSec?: number
  provider: TTSProvider
  latencyMs: number
  error?: string
  errorDetail?: SpeechErrorDetail
}

// ============================================================================
// Voice Pipeline Contracts
// ============================================================================

export interface VoicePipelineInput {
  audio: TranscribeInput
  transcribeOptions?: STTOptions
  /** Optional custom text processor; defaults to AI generateText if omitted */
  processText?: (transcript: string) => Promise<string>
  synthesizeResponse?: boolean
  synthesizeOptions?: TTSOptions
}

export interface VoicePipelineResult {
  success: boolean
  transcript: string
  sttResult: TranscribeResult
  responseText?: string
  ttsResult?: SynthesizeResult
  latencyMs: number
  error?: string
}

// ============================================================================
// Browser Audio Recording Types
// ============================================================================

export type RecordingState = 'idle' | 'recording' | 'paused' | 'stopped' | 'error'

export interface AudioRecording {
  blob: Blob
  url: string
  durationMs: number
  mimeType: string
  byteLength: number
}
