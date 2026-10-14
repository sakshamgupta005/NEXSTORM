/**
 * Provider-Neutral Speech-to-Text (STT) Engine
 * 
 * References:
 * - Faster Whisper: High-throughput local transcription (MIT)
 * - OpenAI Whisper: Speech recognition benchmark (MIT)
 */

import { isValidEnvValue } from '../env'
import type {
  STTProvider,
  STTOptions,
  TranscribeInput,
  TranscribeResult,
  SpeechErrorCode,
} from './types'

export const MAX_AUDIO_BYTES = 25 * 1024 * 1024 // 25 MB default limit

const SUPPORTED_FORMATS = new Set([
  'wav',
  'mp3',
  'ogg',
  'webm',
  'm4a',
  'flac',
  'audio/webm',
  'audio/wav',
  'audio/mp3',
  'audio/ogg',
  'audio/m4a',
  'audio/flac',
])

export function resolveSTTProvider(requested?: STTProvider): STTProvider {
  if (requested) return requested
  if (isValidEnvValue(process.env.WHISPER_SERVICE_URL)) return 'whisper-service'
  if (isValidEnvValue(process.env.GROQ_API_KEY)) return 'groq'
  if (isValidEnvValue(process.env.OPENAI_API_KEY)) return 'openai'
  return 'mock'
}

function raceWithTimeout<T>(
  promise: Promise<T>,
  ms: number,
  errorMessage: string
): Promise<T> {
  let timer: NodeJS.Timeout
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(errorMessage)
      error.name = 'TimeoutError'
      reject(error)
    }, ms)
  })

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timer)
  })
}

/**
 * Validates audio input constraints before dispatching to a provider.
 */
function validateAudioInput(
  input: TranscribeInput,
  maxBytes = MAX_AUDIO_BYTES
): { valid: boolean; error?: string; code?: SpeechErrorCode } {
  const hasData =
    Boolean(input.audioBase64 && input.audioBase64.trim().length > 0) ||
    Boolean(input.audioUrl && input.audioUrl.trim().length > 0) ||
    Boolean(input.audioBuffer && input.audioBuffer.byteLength > 0)

  if (!hasData) {
    return {
      valid: false,
      error: 'Audio input is empty. Provide audioBase64, audioUrl, or audioBuffer.',
      code: 'EMPTY_AUDIO',
    }
  }

  // Check format if specified
  if (input.format) {
    const normalized = input.format.toLowerCase().trim()
    if (!SUPPORTED_FORMATS.has(normalized)) {
      return {
        valid: false,
        error: `Unsupported audio format "${input.format}". Supported: wav, mp3, ogg, webm, m4a, flac.`,
        code: 'UNSUPPORTED_FORMAT',
      }
    }
  }

  // Check byte length limit
  const length =
    input.byteLength ??
    (input.audioBuffer ? input.audioBuffer.byteLength : undefined) ??
    (input.audioBase64 ? Math.round((input.audioBase64.length * 3) / 4) : undefined)

  if (length !== undefined && length > maxBytes) {
    return {
      valid: false,
      error: `Audio input exceeds maximum allowed size of ${Math.round(maxBytes / (1024 * 1024))}MB (got ${Math.round(length / 1024)}KB).`,
      code: 'OVERSIZED_AUDIO',
    }
  }

  return { valid: true }
}

export async function transcribeAudio(
  input: TranscribeInput,
  options?: STTOptions
): Promise<TranscribeResult> {
  const startTime = Date.now()
  const provider = resolveSTTProvider(options?.provider)

  // 1. Validate audio payload
  const validation = validateAudioInput(input, options?.maxSizeBytes)
  if (!validation.valid) {
    return {
      success: false,
      text: '',
      provider,
      latencyMs: Date.now() - startTime,
      error: validation.error,
      errorDetail: {
        code: validation.code || 'PROVIDER_ERROR',
        message: validation.error!,
      },
    }
  }

  // 2. Pre-aborted signal check
  if (options?.signal?.aborted) {
    return {
      success: false,
      text: '',
      provider,
      latencyMs: 0,
      error: 'Transcription was cancelled before starting',
      errorDetail: {
        code: 'CANCELLED',
        message: 'Operation aborted by caller',
      },
    }
  }

  try {
    let transcribePromise: Promise<{
      text: string
      language?: string
      duration?: number
      segments?: Array<{ start: number; end: number; text: string; confidence?: number }>
    }>

    switch (provider) {
      case 'mock': {
        transcribePromise = (async () => {
          const sampleSegments = [
            { start: 0.0, end: 1.8, text: 'Hello assistant,', confidence: 0.98 },
            { start: 1.9, end: 4.5, text: 'please show me the real-time project metrics.', confidence: 0.96 },
          ]
          const promptOverride = input.prompt ? ` [Context: ${input.prompt}]` : ''
          return {
            text: `Hello assistant, please show me the real-time project metrics.${promptOverride}`,
            language: input.language || 'en',
            duration: 4.5,
            segments: sampleSegments,
          }
        })()
        break
      }

      case 'whisper-service': {
        const url = options?.serviceUrl || process.env.WHISPER_SERVICE_URL
        if (!isValidEnvValue(url)) {
          throw new Error('Whisper service URL is not configured (WHISPER_SERVICE_URL)')
        }

        transcribePromise = (async () => {
          const response = await fetch(`${url}/asr`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audio_url: input.audioUrl,
              audio_base64: input.audioBase64,
              language: input.language,
              prompt: input.prompt,
            }),
            signal: options?.signal,
          })

          if (!response.ok) {
            throw new Error(`Whisper service returned HTTP ${response.status}`)
          }

          const data = await response.json()
          return {
            text: data.text || '',
            language: data.language,
            duration: data.duration,
            segments: data.segments,
          }
        })()
        break
      }

      case 'openai':
      case 'groq': {
        const isGroq = provider === 'groq'
        const apiKey = options?.apiKey || (isGroq ? process.env.GROQ_API_KEY : process.env.OPENAI_API_KEY)
        const endpoint = isGroq
          ? 'https://api.groq.com/openai/v1/audio/transcriptions'
          : 'https://api.openai.com/v1/audio/transcriptions'
        const model = isGroq ? 'whisper-large-v3' : 'whisper-1'

        if (!isValidEnvValue(apiKey)) {
          throw new Error(`${isGroq ? 'GROQ_API_KEY' : 'OPENAI_API_KEY'} is not configured`)
        }

        transcribePromise = (async () => {
          // If base64 is provided, convert to blob
          const formData = new FormData()
          formData.append('model', model)
          if (input.language) formData.append('language', input.language)
          if (input.prompt) formData.append('prompt', input.prompt)

          if (input.audioBase64) {
            const raw = input.audioBase64.replace(/^data:audio\/\w+;base64,/, '')
            const buffer = Buffer.from(raw, 'base64')
            const blob = new Blob([buffer], { type: 'audio/wav' })
            formData.append('file', blob, 'audio.wav')
          } else if (input.audioBuffer) {
            const blob = new Blob([input.audioBuffer as unknown as BlobPart], { type: 'audio/wav' })
            formData.append('file', blob, 'audio.wav')
          } else {
            throw new Error('Direct file/buffer upload required for OpenAI/Groq Whisper')
          }

          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
            body: formData,
            signal: options?.signal,
          })

          if (!response.ok) {
            const err = await response.text().catch(() => '')
            throw new Error(`${provider.toUpperCase()} Whisper transcription failed (${response.status}): ${err}`)
          }

          const data = await response.json()
          return {
            text: data.text || '',
            language: data.language,
            duration: data.duration,
            segments: data.segments,
          }
        })()
        break
      }
    }

    if (options?.timeoutMs && options.timeoutMs > 0) {
      transcribePromise = raceWithTimeout(
        transcribePromise,
        options.timeoutMs,
        `Transcription timed out after ${options.timeoutMs}ms`
      )
    }

    const data = await transcribePromise
    const latencyMs = Date.now() - startTime

    return {
      success: true,
      text: data.text,
      language: data.language,
      duration: data.duration,
      segments: data.segments,
      provider,
      latencyMs,
    }
  } catch (err: unknown) {
    const latencyMs = Date.now() - startTime
    const errorMessage = err instanceof Error ? err.message : String(err)
    const errorName = err instanceof Error ? err.name : 'Error'

    let code: SpeechErrorCode = 'PROVIDER_ERROR'
    if (errorName === 'TimeoutError' || errorMessage.includes('timed out')) {
      code = 'TIMEOUT'
    } else if (errorName === 'AbortError' || errorMessage.includes('aborted')) {
      code = 'CANCELLED'
    } else if (errorMessage.includes('not configured')) {
      code = 'NOT_CONFIGURED'
    }

    return {
      success: false,
      text: '',
      provider,
      latencyMs,
      error: errorMessage,
      errorDetail: {
        code,
        message: errorMessage,
        recoverable: code === 'TIMEOUT',
      },
    }
  }
}
