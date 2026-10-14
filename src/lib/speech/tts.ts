/**
 * Provider-Neutral Text-to-Speech (TTS) Engine
 * 
 * References:
 * - Kokoro: Ultra-fast local neural TTS (Apache-2.0)
 * - Piper: Lightweight embedded speech synthesizer (MIT)
 * - ElevenLabs: Realistic voice generation API
 * - OpenAI TTS: Standard cloud audio generation API
 */

import { isValidEnvValue } from '../env'
import type {
  SynthesizeInput,
  SynthesizeResult,
  TTSOptions,
  TTSProvider,
  SpeechErrorCode,
} from './types'

export const MAX_TTS_CHARS = 4096

// Clean base64 WAV sound chime (44-byte silent/chime WAV header)
const MOCK_WAV_BASE64 =
  'UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAAE='

export function resolveTTSProvider(requested?: TTSProvider): TTSProvider {
  if (requested) return requested
  if (isValidEnvValue(process.env.KOKORO_SERVICE_URL)) return 'kokoro-service'
  if (isValidEnvValue(process.env.PIPER_SERVICE_URL)) return 'piper-service'
  if (isValidEnvValue(process.env.ELEVENLABS_API_KEY)) return 'elevenlabs'
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
 * Validates text input before speech synthesis.
 */
function validateTextInput(
  input: SynthesizeInput,
  maxChars = MAX_TTS_CHARS
): { valid: boolean; error?: string; code?: SpeechErrorCode } {
  const text = input.text ? input.text.trim() : ''
  if (!text) {
    return {
      valid: false,
      error: 'Text input for speech synthesis cannot be empty.',
      code: 'EMPTY_TEXT',
    }
  }

  if (text.length > maxChars) {
    return {
      valid: false,
      error: `Text input exceeds maximum limit of ${maxChars} characters (got ${text.length}).`,
      code: 'OVERSIZED_TEXT',
    }
  }

  return { valid: true }
}

export async function synthesizeSpeech(
  input: SynthesizeInput,
  options?: TTSOptions
): Promise<SynthesizeResult> {
  const startTime = Date.now()
  const provider = resolveTTSProvider(options?.provider)
  const format = input.format || 'mp3'

  // 1. Validation
  const validation = validateTextInput(input, options?.maxChars)
  if (!validation.valid) {
    return {
      success: false,
      format,
      provider,
      latencyMs: Date.now() - startTime,
      error: validation.error,
      errorDetail: {
        code: validation.code || 'PROVIDER_ERROR',
        message: validation.error!,
      },
    }
  }

  // 2. Cancellation check
  if (options?.signal?.aborted) {
    return {
      success: false,
      format,
      provider,
      latencyMs: 0,
      error: 'Speech synthesis was cancelled before starting',
      errorDetail: {
        code: 'CANCELLED',
        message: 'Operation aborted by caller',
      },
    }
  }

  try {
    let synthesizePromise: Promise<{
      audioBase64?: string
      audioUrl?: string
      format: string
      durationEstimateSec?: number
    }>

    switch (provider) {
      case 'mock':
      case 'browser': {
        synthesizePromise = (async () => {
          // Estimate spoken duration: ~150 words per minute -> 2.5 words/sec
          const wordCount = input.text.trim().split(/\s+/).length
          const durationEstimateSec = Math.max(1, Math.round((wordCount / 2.5) * 10) / 10)

          return {
            audioBase64: MOCK_WAV_BASE64,
            audioUrl: `data:audio/wav;base64,${MOCK_WAV_BASE64}`,
            format: 'wav',
            durationEstimateSec,
          }
        })()
        break
      }

      case 'openai': {
        const apiKey = options?.apiKey || process.env.OPENAI_API_KEY
        if (!isValidEnvValue(apiKey)) {
          throw new Error('OPENAI_API_KEY is not configured for OpenAI TTS')
        }

        synthesizePromise = (async () => {
          const response = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'tts-1',
              input: input.text,
              voice: input.voice || 'alloy',
              speed: input.speed ?? 1.0,
              response_format: format,
            }),
            signal: options?.signal,
          })

          if (!response.ok) {
            const err = await response.text().catch(() => '')
            throw new Error(`OpenAI TTS synthesis failed (${response.status}): ${err}`)
          }

          const arrayBuffer = await response.arrayBuffer()
          const base64 = Buffer.from(arrayBuffer).toString('base64')
          const wordCount = input.text.trim().split(/\s+/).length

          return {
            audioBase64: base64,
            audioUrl: `data:audio/${format};base64,${base64}`,
            format,
            durationEstimateSec: Math.max(1, Math.round((wordCount / 2.5) * 10) / 10),
          }
        })()
        break
      }

      case 'elevenlabs': {
        const apiKey = options?.apiKey || process.env.ELEVENLABS_API_KEY
        if (!isValidEnvValue(apiKey)) {
          throw new Error('ELEVENLABS_API_KEY is not configured')
        }

        const voiceId = input.voice || '21m00Tcm4TlvDq8ikWAM' // Default Rachel voice
        synthesizePromise = (async () => {
          const response = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
            {
              method: 'POST',
              headers: {
                'xi-api-key': apiKey!,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                text: input.text,
                model_id: 'eleven_monolingual_v1',
              }),
              signal: options?.signal,
            }
          )

          if (!response.ok) {
            const err = await response.text().catch(() => '')
            throw new Error(`ElevenLabs TTS synthesis failed (${response.status}): ${err}`)
          }

          const arrayBuffer = await response.arrayBuffer()
          const base64 = Buffer.from(arrayBuffer).toString('base64')

          return {
            audioBase64: base64,
            format: 'mp3',
          }
        })()
        break
      }

      case 'kokoro-service':
      case 'piper-service': {
        const url =
          options?.serviceUrl ||
          (provider === 'kokoro-service'
            ? process.env.KOKORO_SERVICE_URL
            : process.env.PIPER_SERVICE_URL)

        if (!isValidEnvValue(url)) {
          throw new Error(
            `${provider === 'kokoro-service' ? 'KOKORO_SERVICE_URL' : 'PIPER_SERVICE_URL'} is not configured`
          )
        }

        synthesizePromise = (async () => {
          const response = await fetch(`${url}/v1/audio/speech`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: input.text,
              voice: input.voice,
              speed: input.speed,
            }),
            signal: options?.signal,
          })

          if (!response.ok) {
            throw new Error(`${provider} returned HTTP ${response.status}`)
          }

          const arrayBuffer = await response.arrayBuffer()
          const base64 = Buffer.from(arrayBuffer).toString('base64')

          return {
            audioBase64: base64,
            format: 'wav',
          }
        })()
        break
      }
    }

    if (options?.timeoutMs && options.timeoutMs > 0) {
      synthesizePromise = raceWithTimeout(
        synthesizePromise,
        options.timeoutMs,
        `Speech synthesis timed out after ${options.timeoutMs}ms`
      )
    }

    const data = await synthesizePromise
    const latencyMs = Date.now() - startTime

    return {
      success: true,
      audioBase64: data.audioBase64,
      audioUrl: data.audioUrl,
      format: data.format,
      durationEstimateSec: data.durationEstimateSec,
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
      format,
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
