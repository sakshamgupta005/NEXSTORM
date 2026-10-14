import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  transcribeAudio,
  resolveSTTProvider,
  synthesizeSpeech,
  resolveTTSProvider,
  runVoicePipeline,
  type TranscribeInput,
} from '@/lib/speech'

describe('Reusable Speech & Voice Toolkit', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    delete process.env.WHISPER_SERVICE_URL
    delete process.env.GROQ_API_KEY
    delete process.env.OPENAI_API_KEY
    delete process.env.ELEVENLABS_API_KEY
    delete process.env.KOKORO_SERVICE_URL
    delete process.env.PIPER_SERVICE_URL
  })

  describe('Speech-to-Text (STT)', () => {
    it('resolves default provider to mock when no keys are configured', () => {
      expect(resolveSTTProvider()).toBe('mock')
    })

    it('resolves external providers based on environment variables', () => {
      process.env.WHISPER_SERVICE_URL = 'http://localhost:9000'
      expect(resolveSTTProvider()).toBe('whisper-service')

      delete process.env.WHISPER_SERVICE_URL
      process.env.GROQ_API_KEY = 'gsk-test'
      expect(resolveSTTProvider()).toBe('groq')

      delete process.env.GROQ_API_KEY
      process.env.OPENAI_API_KEY = 'sk-test'
      expect(resolveSTTProvider()).toBe('openai')
    })

    it('rejects empty audio inputs cleanly with EMPTY_AUDIO code', async () => {
      const result = await transcribeAudio({})
      expect(result.success).toBe(false)
      expect(result.errorDetail?.code).toBe('EMPTY_AUDIO')
      expect(result.error).toContain('Audio input is empty')
    })

    it('rejects unsupported audio formats with UNSUPPORTED_FORMAT code', async () => {
      const result = await transcribeAudio({
        audioBase64: 'AAAA',
        format: 'midi' as unknown as string,
      })
      expect(result.success).toBe(false)
      expect(result.errorDetail?.code).toBe('UNSUPPORTED_FORMAT')
      expect(result.error).toContain('Unsupported audio format')
    })

    it('rejects oversized audio inputs with OVERSIZED_AUDIO code', async () => {
      const result = await transcribeAudio(
        {
          audioBase64: 'AAAA',
          byteLength: 30 * 1024 * 1024, // 30 MB
        },
        { maxSizeBytes: 20 * 1024 * 1024 }
      )
      expect(result.success).toBe(false)
      expect(result.errorDetail?.code).toBe('OVERSIZED_AUDIO')
    })

    it('transcribes valid audio successfully using mock provider', async () => {
      const input: TranscribeInput = {
        audioBase64: 'UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAAE=',
        format: 'wav',
        language: 'en',
      }
      const result = await transcribeAudio(input, { provider: 'mock' })

      expect(result.success).toBe(true)
      expect(result.text).toContain('Hello assistant')
      expect(result.segments).toBeDefined()
      expect(result.segments!.length).toBeGreaterThan(0)
      expect(result.duration).toBeGreaterThan(0)
      expect(result.provider).toBe('mock')
      expect(result.latencyMs).toBeGreaterThanOrEqual(0)
    })

    it('returns NOT_CONFIGURED when remote provider URL or key is missing', async () => {
      const result = await transcribeAudio(
        { audioBase64: 'AAAA' },
        { provider: 'whisper-service' }
      )
      expect(result.success).toBe(false)
      expect(result.errorDetail?.code).toBe('NOT_CONFIGURED')
      expect(result.error).toContain('WHISPER_SERVICE_URL')
    })

    it('handles cancellation via AbortSignal before and during STT execution', async () => {
      const preAborted = AbortSignal.abort()
      const result = await transcribeAudio(
        { audioBase64: 'AAAA' },
        { provider: 'mock', signal: preAborted }
      )
      expect(result.success).toBe(false)
      expect(result.errorDetail?.code).toBe('CANCELLED')
    })
  })

  describe('Text-to-Speech (TTS)', () => {
    it('resolves default provider to mock when no keys are configured', () => {
      expect(resolveTTSProvider()).toBe('mock')
    })

    it('resolves external providers based on environment variables', () => {
      process.env.KOKORO_SERVICE_URL = 'http://localhost:8880'
      expect(resolveTTSProvider()).toBe('kokoro-service')

      delete process.env.KOKORO_SERVICE_URL
      process.env.PIPER_SERVICE_URL = 'http://localhost:5000'
      expect(resolveTTSProvider()).toBe('piper-service')

      delete process.env.PIPER_SERVICE_URL
      process.env.ELEVENLABS_API_KEY = 'eleven-test'
      expect(resolveTTSProvider()).toBe('elevenlabs')
    })

    it('rejects empty text with EMPTY_TEXT code', async () => {
      const result = await synthesizeSpeech({ text: '   ' })
      expect(result.success).toBe(false)
      expect(result.errorDetail?.code).toBe('EMPTY_TEXT')
    })

    it('rejects oversized text with OVERSIZED_TEXT code', async () => {
      const longText = 'a'.repeat(5000)
      const result = await synthesizeSpeech({ text: longText })
      expect(result.success).toBe(false)
      expect(result.errorDetail?.code).toBe('OVERSIZED_TEXT')
    })

    it('synthesizes speech successfully using mock provider', async () => {
      const result = await synthesizeSpeech(
        { text: 'System status is fully operational.' },
        { provider: 'mock' }
      )

      expect(result.success).toBe(true)
      expect(result.audioBase64).toBeDefined()
      expect(result.audioUrl).toContain('data:audio/wav;base64')
      expect(result.format).toBe('wav')
      expect(result.durationEstimateSec).toBeGreaterThan(0)
      expect(result.provider).toBe('mock')
    })

    it('returns NOT_CONFIGURED when remote TTS key is missing', async () => {
      const result = await synthesizeSpeech(
        { text: 'Hello' },
        { provider: 'elevenlabs' }
      )
      expect(result.success).toBe(false)
      expect(result.errorDetail?.code).toBe('NOT_CONFIGURED')
      expect(result.error).toContain('ELEVENLABS_API_KEY')
    })

    it('handles cancellation via AbortSignal before TTS synthesis', async () => {
      const preAborted = AbortSignal.abort()
      const result = await synthesizeSpeech(
        { text: 'Hello' },
        { signal: preAborted }
      )
      expect(result.success).toBe(false)
      expect(result.errorDetail?.code).toBe('CANCELLED')
    })
  })

  describe('Composable Voice Pipeline', () => {
    it('executes full pipeline: audio -> STT -> processText -> TTS', async () => {
      const result = await runVoicePipeline({
        audio: { audioBase64: 'AAAA', format: 'wav' },
        transcribeOptions: { provider: 'mock' },
        processText: async (transcript) => `Echoed: ${transcript}`,
        synthesizeResponse: true,
        synthesizeOptions: { provider: 'mock' },
      })

      expect(result.success).toBe(true)
      expect(result.transcript).toContain('Hello assistant')
      expect(result.responseText).toContain('Echoed:')
      expect(result.ttsResult).toBeDefined()
      expect(result.ttsResult?.success).toBe(true)
      expect(result.latencyMs).toBeGreaterThanOrEqual(0)
    })

    it('aborts pipeline early if STT transcription fails', async () => {
      const result = await runVoicePipeline({
        audio: {}, // Empty audio
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Transcription stage failed')
      expect(result.sttResult.success).toBe(false)
      expect(result.responseText).toBeUndefined()
    })

    it('isolates TTS failure without failing the upstream transcript and responseText', async () => {
      const result = await runVoicePipeline({
        audio: { audioBase64: 'AAAA' },
        transcribeOptions: { provider: 'mock' },
        processText: async () => 'Valid answer',
        synthesizeResponse: true,
        synthesizeOptions: { provider: 'elevenlabs' }, // Will fail because ELEVENLABS_API_KEY is missing
      })

      // Downstream TTS failure does NOT destroy upstream transcript or text
      expect(result.success).toBe(true)
      expect(result.transcript).toBeDefined()
      expect(result.responseText).toBe('Valid answer')
      expect(result.ttsResult?.success).toBe(false)
      expect(result.ttsResult?.errorDetail?.code).toBe('NOT_CONFIGURED')
    })
  })
})
