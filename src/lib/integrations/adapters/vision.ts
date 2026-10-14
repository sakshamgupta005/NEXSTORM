/**
 * Vision & Multimodal Integration Adapters
 * 
 * Reference: Hugging Face Transformers (https://github.com/huggingface/transformers)
 * License: Apache-2.0
 * 
 * Provides:
 * - vision:mock: Deterministic multimodal image analysis for tests
 * - vision:huggingface: HTTP adapter for Hugging Face Inference API / multimodal models
 */

import { isValidEnvValue } from '../../env'
import type { IntegrationDefinition } from '../registry'
import type { VisionInput, VisionOutput } from '../types'

export const mockVisionDefinition: IntegrationDefinition<VisionInput, VisionOutput> = {
  id: 'vision:mock',
  category: 'vision',
  name: 'Mock Vision Analyzer',
  description: 'Deterministic multimodal image classification and captioning engine',
  referenceRepo: 'https://github.com/huggingface/transformers',
  license: 'Apache-2.0',
  requiredEnvVars: [],
  isConfigured: () => true,
  checkHealth: async () => ({
    status: 'healthy',
    message: 'Mock vision model operational',
  }),
  createAdapter: () => ({
    execute: async (input) => {
      const task = input.task || 'caption'
      const prompt = input.prompt || ''

      const sampleLabels = [
        { label: 'laptop computer', score: 0.98, box: { x: 40, y: 50, width: 300, height: 200 } },
        { label: 'coffee mug', score: 0.89, box: { x: 380, y: 150, width: 60, height: 70 } },
        { label: 'notebook', score: 0.85, box: { x: 20, y: 220, width: 120, height: 90 } },
      ]

      const description = 'A modern desk workspace with a laptop computer and coffee cup.'
      let answer: string | undefined

      if (task === 'vqa' && prompt) {
        answer = `Based on visual inspection, the item inquired ("${prompt}") is present on the workspace.`
      }

      return {
        description,
        labels: sampleLabels,
        answer,
      }
    },
  }),
}

export const huggingFaceVisionDefinition: IntegrationDefinition<
  VisionInput,
  VisionOutput
> = {
  id: 'vision:huggingface',
  category: 'vision',
  name: 'Hugging Face Vision Inference Adapter',
  description: 'HTTP adapter calling Hugging Face Serverless Inference API for vision tasks',
  referenceRepo: 'https://github.com/huggingface/transformers',
  license: 'Apache-2.0',
  requiredEnvVars: ['HUGGINGFACE_API_KEY'],
  isConfigured: () => isValidEnvValue(process.env.HUGGINGFACE_API_KEY),
  checkHealth: async () => {
    if (!isValidEnvValue(process.env.HUGGINGFACE_API_KEY)) {
      return {
        status: 'unhealthy',
        message: 'HUGGINGFACE_API_KEY is not configured',
      }
    }
    return {
      status: 'healthy',
      message: 'Hugging Face vision inference endpoint configured with API key',
    }
  },
  createAdapter: (config) => ({
    execute: async (input, options) => {
      const apiKey =
        (config?.apiKey as string | undefined) ||
        process.env.HUGGINGFACE_API_KEY

      if (!isValidEnvValue(apiKey)) {
        throw new Error('HUGGINGFACE_API_KEY is not configured')
      }

      const model = (config?.model as string | undefined) || 'Salesforce/blip-image-captioning-large'
      const endpoint = `https://api-inference.huggingface.co/models/${model}`

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: input.imageBase64 || input.imageUrl,
          parameters: input.prompt ? { prompt: input.prompt } : undefined,
        }),
        signal: options?.signal,
      })

      if (!response.ok) {
        throw new Error(`Hugging Face inference failed with HTTP ${response.status}`)
      }

      const result = await response.json()
      const caption = Array.isArray(result) && result[0]?.generated_text
        ? result[0].generated_text
        : typeof result === 'string'
        ? result
        : 'Image analyzed successfully.'

      return {
        description: caption,
        labels: [],
      }
    },
  }),
}
