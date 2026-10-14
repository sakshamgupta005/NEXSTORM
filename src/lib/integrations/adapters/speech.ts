/**
 * Speech Recognition Integration Adapters
 * 
 * Reference: Faster-Whisper (https://github.com/SYSTRAN/faster-whisper)
 * License: MIT
 * 
 * Provides:
 * - speech:mock: Deterministic audio transcription for tests
 * - speech:whisper: HTTP adapter for Faster-Whisper or Whisper ASR endpoints
 */

import { isValidEnvValue } from '../../env'
import type { IntegrationDefinition } from '../registry'
import type { SpeechTranscriptionInput, SpeechTranscriptionOutput } from '../types'

export const mockSpeechDefinition: IntegrationDefinition<
  SpeechTranscriptionInput,
  SpeechTranscriptionOutput
> = {
  id: 'speech:mock',
  category: 'speech',
  name: 'Mock Speech Transcriber',
  description: 'Deterministic speech-to-text transcriber for testing and preview',
  referenceRepo: 'https://github.com/SYSTRAN/faster-whisper',
  license: 'MIT',
  requiredEnvVars: [],
  isConfigured: () => true,
  checkHealth: async () => ({
    status: 'healthy',
    message: 'Mock speech transcription engine operational',
  }),
  createAdapter: () => ({
    execute: async (input) => {
      const sampleSegments = [
        { start: 0.0, end: 2.5, text: 'Hello, welcome to the hackathon project demo.', confidence: 0.98 },
        { start: 2.6, end: 5.1, text: 'The automated speech recognition system is fully operational.', confidence: 0.96 },
      ]

      return {
        text: sampleSegments.map((s) => s.text).join(' '),
        duration: 5.1,
        language: input.language || 'en',
        segments: sampleSegments,
      }
    },
  }),
}

export const whisperSpeechDefinition: IntegrationDefinition<
  SpeechTranscriptionInput,
  SpeechTranscriptionOutput
> = {
  id: 'speech:whisper',
  category: 'speech',
  name: 'Faster-Whisper Service Adapter',
  description: 'HTTP adapter connecting to Faster-Whisper ASR webservice or container',
  referenceRepo: 'https://github.com/SYSTRAN/faster-whisper',
  license: 'MIT',
  requiredEnvVars: ['WHISPER_SERVICE_URL'],
  isConfigured: () => isValidEnvValue(process.env.WHISPER_SERVICE_URL),
  checkHealth: async () => {
    const url = process.env.WHISPER_SERVICE_URL
    if (!isValidEnvValue(url)) {
      return {
        status: 'unhealthy',
        message: 'WHISPER_SERVICE_URL is not configured',
      }
    }
    return {
      status: 'healthy',
      message: `Whisper service endpoint configured at ${url}`,
    }
  },
  createAdapter: (config) => ({
    execute: async (input, options) => {
      const serviceUrl =
        (config?.serviceUrl as string | undefined) ||
        process.env.WHISPER_SERVICE_URL

      if (!isValidEnvValue(serviceUrl)) {
        throw new Error('WHISPER_SERVICE_URL is not configured')
      }

      const response = await fetch(serviceUrl!, {
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
        throw new Error(`Whisper transcription service failed with HTTP ${response.status}`)
      }

      const data = await response.json()
      return {
        text: data.text || '',
        duration: data.duration,
        language: data.language,
        segments: (data.segments || []).map(
          (s: { start?: number; end?: number; text?: string; confidence?: number }) => ({
            start: Number(s.start ?? 0),
            end: Number(s.end ?? 0),
            text: s.text || '',
            confidence: s.confidence,
          })
        ),
      }
    },
  }),
}
