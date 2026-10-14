/**
 * Composable Voice Pipeline: Audio -> STT -> AI Processing -> TTS
 * 
 * Chains together:
 * 1. Audio transcription via transcribeAudio
 * 2. Text / AI reasoning (custom handler or generateText)
 * 3. Speech synthesis via synthesizeSpeech
 * 
 * Features:
 * - Stage error isolation: downstream TTS errors do not destroy upstream transcripts
 * - Independent stage testing and configuration
 * - Strict latency measurement and error normalization
 */

import { generateText } from '../ai/client'
import { transcribeAudio } from './stt'
import { synthesizeSpeech } from './tts'
import type {
  VoicePipelineInput,
  VoicePipelineResult,
  SynthesizeResult,
} from './types'

export async function runVoicePipeline(
  input: VoicePipelineInput
): Promise<VoicePipelineResult> {
  const startTime = Date.now()

  // 1. STT Transcription
  const sttResult = await transcribeAudio(input.audio, input.transcribeOptions)
  if (!sttResult.success) {
    return {
      success: false,
      transcript: '',
      sttResult,
      latencyMs: Date.now() - startTime,
      error: `Transcription stage failed: ${sttResult.error || 'Unknown error'}`,
    }
  }

  const transcript = sttResult.text

  // 2. Application / AI Processing
  let responseText: string
  try {
    if (typeof input.processText === 'function') {
      responseText = await input.processText(transcript)
    } else {
      const aiResult = await generateText({
        prompt: transcript,
        system: 'You are a helpful, concise voice assistant. Keep answers brief and conversational.',
        provider: 'mock',
      })
      responseText = aiResult.data || 'I heard your request and have processed it.'
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      transcript,
      sttResult,
      latencyMs: Date.now() - startTime,
      error: `Processing stage failed: ${errorMsg}`,
    }
  }

  // 3. TTS Synthesis (Optional)
  let ttsResult: SynthesizeResult | undefined = undefined

  if (input.synthesizeResponse !== false && responseText) {
    ttsResult = await synthesizeSpeech(
      { text: responseText },
      input.synthesizeOptions
    )
  }

  const latencyMs = Date.now() - startTime

  return {
    success: true,
    transcript,
    sttResult,
    responseText,
    ttsResult,
    latencyMs,
  }
}
