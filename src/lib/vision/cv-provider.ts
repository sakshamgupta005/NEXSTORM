/**
 * Reusable Computer Vision Providers & Adapters
 * 
 * References:
 * - Ultralytics YOLO: Object detection & confidence filtering (AGPL-3.0 / Enterprise)
 * - MediaPipe: Visual perception models & normalized coordinate space (Apache-2.0)
 * - Transformers.js: Zero-backend inference schemas (Apache-2.0)
 * - ONNX Runtime: Model execution standards (MIT)
 */

import type { ImageInput, BoundingBox } from './types'
import type {
  IComputerVisionProvider,
  DetectedObject,
  ClassificationResult,
  ImageEmbeddingResult,
  DetectionOptions,
  ClassificationOptions,
  EmbeddingOptions,
} from './cv-types'

/**
 * Clamps and normalizes a bounding box so all coordinates stay strictly within [0.0, 1.0].
 */
export function normalizeBoundingBox(box: BoundingBox): BoundingBox {
  const x = Math.max(0, Math.min(1, Number(box.x) || 0))
  const y = Math.max(0, Math.min(1, Number(box.y) || 0))
  const width = Math.max(0, Math.min(1 - x, Number(box.width) || 0))
  const height = Math.max(0, Math.min(1 - y, Number(box.height) || 0))

  return {
    x: Math.round(x * 10000) / 10000,
    y: Math.round(y * 10000) / 10000,
    width: Math.round(width * 10000) / 10000,
    height: Math.round(height * 10000) / 10000,
  }
}

/**
 * Validates that an image input contains accessible data.
 */
function validateImageInput(image: ImageInput): void {
  if (!image) {
    throw new Error('Image input cannot be null or undefined')
  }
  const hasData =
    Boolean(image.imageBase64) ||
    Boolean(image.imageUrl) ||
    Boolean(image.imageBuffer && image.imageBuffer.length > 0)

  if (!hasData) {
    throw new Error('Image input must provide imageBase64, imageUrl, or imageBuffer')
  }
}

/**
 * Deterministic Mock Computer Vision Provider for 100% offline development and unit tests.
 */
export class MockComputerVisionProvider implements IComputerVisionProvider {
  private defaultDetections: DetectedObject[] = [
    {
      label: 'person',
      confidence: 0.94,
      box: { x: 0.15, y: 0.1, width: 0.35, height: 0.75 },
    },
    {
      label: 'laptop',
      confidence: 0.88,
      box: { x: 0.45, y: 0.55, width: 0.3, height: 0.25 },
    },
    {
      label: 'cup',
      confidence: 0.72,
      box: { x: 0.8, y: 0.65, width: 0.1, height: 0.15 },
    },
    {
      label: 'chair',
      confidence: 0.45,
      box: { x: 0.05, y: 0.4, width: 0.25, height: 0.55 },
    },
  ]

  private defaultClassifications: ClassificationResult[] = [
    { label: 'office_workspace', confidence: 0.91 },
    { label: 'technology_interior', confidence: 0.78 },
    { label: 'indoor_setting', confidence: 0.64 },
    { label: 'desk_setup', confidence: 0.52 },
    { label: 'meeting_room', confidence: 0.28 },
  ]

  public async detectObjects(
    image: ImageInput,
    options: DetectionOptions = {}
  ): Promise<DetectedObject[]> {
    validateImageInput(image)

    if (options.signal?.aborted) {
      throw new Error('Inference aborted by caller')
    }

    const minConfidence = options.minConfidence ?? 0.25
    const maxDetections = options.maxDetections ?? 50

    return this.defaultDetections
      .filter((d) => d.confidence >= minConfidence)
      .slice(0, maxDetections)
      .map((d) => ({
        ...d,
        box: normalizeBoundingBox(d.box),
      }))
  }

  public async classifyImage(
    image: ImageInput,
    options: ClassificationOptions = {}
  ): Promise<ClassificationResult[]> {
    validateImageInput(image)

    if (options.signal?.aborted) {
      throw new Error('Inference aborted by caller')
    }

    const minConfidence = options.minConfidence ?? 0.1
    const topK = options.topK ?? 5

    return this.defaultClassifications
      .filter((c) => c.confidence >= minConfidence)
      .slice(0, topK)
  }

  public async extractImageEmbedding(
    image: ImageInput,
    options: EmbeddingOptions = {}
  ): Promise<ImageEmbeddingResult> {
    validateImageInput(image)

    if (options.signal?.aborted) {
      throw new Error('Inference aborted by caller')
    }

    // Generate a normalized 512-dimensional unit vector
    const dimensions = 512
    const raw = new Array(dimensions).fill(0).map((_, i) => Math.sin(i + 1))
    const norm = Math.sqrt(raw.reduce((sum, v) => sum + v * v, 0)) || 1
    const embedding = raw.map((v) => Math.round((v / norm) * 100000) / 100000)

    return {
      embedding,
      dimensions,
      model: options.model ?? 'mock-vit-base',
    }
  }
}

/**
 * Configuration options for the HTTP REST Computer Vision client.
 */
export interface HttpVisionProviderOptions {
  serviceUrl?: string
  apiKey?: string
  defaultTimeoutMs?: number
}

/**
 * Production-ready HTTP adapter connecting to external or microservice vision endpoints
 * (e.g. Ultralytics YOLO FastAPI service, ONNX Runtime Web server, or MediaPipe microservice).
 */
export class HttpComputerVisionProvider implements IComputerVisionProvider {
  private serviceUrl?: string
  private apiKey?: string
  private defaultTimeoutMs: number

  constructor(options: HttpVisionProviderOptions = {}) {
    this.serviceUrl = options.serviceUrl || process.env.VISION_SERVICE_URL
    this.apiKey = options.apiKey || process.env.VISION_API_KEY
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 15000
  }

  public async detectObjects(
    image: ImageInput,
    options: DetectionOptions = {}
  ): Promise<DetectedObject[]> {
    validateImageInput(image)
    if (!this.serviceUrl) {
      throw new Error('HttpComputerVisionProvider requires VISION_SERVICE_URL to be configured')
    }

    const timeout = options.timeoutMs ?? this.defaultTimeoutMs
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(`${this.serviceUrl}/detect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify({
          image: image.imageBase64 || image.imageUrl,
          min_confidence: options.minConfidence ?? 0.25,
          max_detections: options.maxDetections ?? 50,
          model: options.model,
        }),
        signal: options.signal ?? controller.signal,
      })

      if (!response.ok) {
        throw new Error(`Vision service HTTP error: ${response.status} ${response.statusText}`)
      }

      const data = (await response.json()) as { detections?: Array<{ label: string; confidence: number; box: BoundingBox }> }
      const detections = data.detections || []

      return detections.map((d) => ({
        label: d.label,
        confidence: d.confidence,
        box: normalizeBoundingBox(d.box),
      }))
    } finally {
      clearTimeout(timer)
    }
  }

  public async classifyImage(
    image: ImageInput,
    options: ClassificationOptions = {}
  ): Promise<ClassificationResult[]> {
    validateImageInput(image)
    if (!this.serviceUrl) {
      throw new Error('HttpComputerVisionProvider requires VISION_SERVICE_URL to be configured')
    }

    const timeout = options.timeoutMs ?? this.defaultTimeoutMs
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(`${this.serviceUrl}/classify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify({
          image: image.imageBase64 || image.imageUrl,
          min_confidence: options.minConfidence ?? 0.1,
          top_k: options.topK ?? 5,
          model: options.model,
        }),
        signal: options.signal ?? controller.signal,
      })

      if (!response.ok) {
        throw new Error(`Vision service HTTP error: ${response.status} ${response.statusText}`)
      }

      const data = (await response.json()) as { classifications?: ClassificationResult[] }
      return data.classifications || []
    } finally {
      clearTimeout(timer)
    }
  }

  public async extractImageEmbedding(
    image: ImageInput,
    options: EmbeddingOptions = {}
  ): Promise<ImageEmbeddingResult> {
    validateImageInput(image)
    if (!this.serviceUrl) {
      throw new Error('HttpComputerVisionProvider requires VISION_SERVICE_URL to be configured')
    }

    const timeout = options.timeoutMs ?? this.defaultTimeoutMs
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(`${this.serviceUrl}/embed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify({
          image: image.imageBase64 || image.imageUrl,
          model: options.model,
        }),
        signal: options.signal ?? controller.signal,
      })

      if (!response.ok) {
        throw new Error(`Vision service HTTP error: ${response.status} ${response.statusText}`)
      }

      const data = (await response.json()) as ImageEmbeddingResult
      return data
    } finally {
      clearTimeout(timer)
    }
  }
}

/** Global singleton computer vision provider */
export const sharedComputerVisionProvider: IComputerVisionProvider =
  process.env.VISION_SERVICE_URL
    ? new HttpComputerVisionProvider()
    : new MockComputerVisionProvider()
