import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  MockComputerVisionProvider,
  HttpComputerVisionProvider,
  normalizeBoundingBox,
  validateVideoInput,
  extractVideoFrames,
  analyzeVideo,
  type ImageInput,
  type VideoInput,
} from '@/lib/vision'

describe('Part 4.14 — Computer Vision & Video Processing Toolkit', () => {
  let mockProvider: MockComputerVisionProvider

  beforeEach(() => {
    vi.restoreAllMocks()
    mockProvider = new MockComputerVisionProvider()
  })

  describe('1. Input Validation & Bounding Box Normalization', () => {
    it('normalizes and clamps out-of-bounds bounding box coordinates to [0.0, 1.0]', () => {
      // Coordinates exceeding boundaries
      const oversized = normalizeBoundingBox({ x: -0.2, y: 1.5, width: 1.8, height: 0.9 })
      expect(oversized.x).toBe(0)
      expect(oversized.y).toBe(1)
      expect(oversized.width).toBe(1)
      expect(oversized.height).toBe(0)

      // Valid coordinates within standard boundaries
      const valid = normalizeBoundingBox({ x: 0.25, y: 0.35, width: 0.5, height: 0.4 })
      expect(valid.x).toBe(0.25)
      expect(valid.y).toBe(0.35)
      expect(valid.width).toBe(0.5)
      expect(valid.height).toBe(0.4)
    })

    it('rejects empty or invalid image inputs', async () => {
      await expect(
        mockProvider.detectObjects(null as unknown as ImageInput)
      ).rejects.toThrow('Image input cannot be null or undefined')

      await expect(
        mockProvider.detectObjects({} as ImageInput)
      ).rejects.toThrow('Image input must provide imageBase64, imageUrl, or imageBuffer')
    })
  })

  describe('2. Object Detection & Confidence Thresholding', () => {
    it('detects objects with normalized bounding boxes and respects minConfidence', async () => {
      const sampleImage: ImageInput = {
        imageBase64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      }

      // Default threshold (0.25) -> returns all 4 detections
      const allDetections = await mockProvider.detectObjects(sampleImage)
      expect(allDetections.length).toBe(4)
      expect(allDetections[0].label).toBe('person')
      expect(allDetections[0].confidence).toBeGreaterThanOrEqual(0.9)

      // Strict threshold (0.8) -> filters out cup (0.72) and chair (0.45)
      const strictDetections = await mockProvider.detectObjects(sampleImage, {
        minConfidence: 0.8,
      })
      expect(strictDetections.length).toBe(2)
      expect(strictDetections.map((d) => d.label)).toEqual(['person', 'laptop'])
    })

    it('respects maxDetections limit', async () => {
      const sampleImage: ImageInput = {
        imageUrl: 'https://example.com/workspace.jpg',
      }

      const capped = await mockProvider.detectObjects(sampleImage, { maxDetections: 1 })
      expect(capped.length).toBe(1)
      expect(capped[0].label).toBe('person')
    })
  })

  describe('3. Image Classification & Embedding Extraction', () => {
    it('classifies scene content and filters by minConfidence and topK', async () => {
      const sampleImage: ImageInput = {
        imageUrl: 'https://example.com/office.jpg',
      }

      const results = await mockProvider.classifyImage(sampleImage, {
        minConfidence: 0.5,
        topK: 2,
      })

      expect(results.length).toBe(2)
      expect(results[0].label).toBe('office_workspace')
      expect(results[0].confidence).toBe(0.91)
      expect(results[1].label).toBe('technology_interior')
    })

    it('extracts normalized 512-dimensional embedding vector', async () => {
      const sampleImage: ImageInput = {
        imageUrl: 'https://example.com/item.jpg',
      }

      const embedding = await mockProvider.extractImageEmbedding(sampleImage)
      expect(embedding.dimensions).toBe(512)
      expect(embedding.embedding.length).toBe(512)
      expect(embedding.model).toBe('mock-vit-base')

      // Norm of unit vector should be approximately 1
      const norm = Math.sqrt(
        embedding.embedding.reduce((acc, v) => acc + v * v, 0)
      )
      expect(norm).toBeCloseTo(1, 2)
    })
  })

  describe('4. Video Validation & Frame Extraction', () => {
    it('validates video inputs against format, size, and duration constraints', () => {
      // 1. Missing source
      const missing = validateVideoInput({} as VideoInput)
      expect(missing.valid).toBe(false)
      expect(missing.errorCode).toBe('MISSING_SOURCE')

      // 2. Unsupported format (e.g. video/x-flv)
      const unsupported = validateVideoInput({
        videoUrl: 'https://example.com/video.flv',
        mimeType: 'video/x-flv',
      })
      expect(unsupported.valid).toBe(false)
      expect(unsupported.errorCode).toBe('UNSUPPORTED_FORMAT')

      // 3. Oversized file (> 50MB)
      const oversizedBuffer = new Uint8Array(55 * 1024 * 1024)
      const oversized = validateVideoInput(
        { videoBuffer: oversizedBuffer },
        { maxFileSizeBytes: 50 * 1024 * 1024 }
      )
      expect(oversized.valid).toBe(false)
      expect(oversized.errorCode).toBe('FILE_TOO_LARGE')

      // 4. Exceeded duration (> 60s)
      const tooLong = validateVideoInput(
        { videoUrl: 'https://example.com/stream.mp4', durationSeconds: 120 },
        { maxDurationSeconds: 60 }
      )
      expect(tooLong.valid).toBe(false)
      expect(tooLong.errorCode).toBe('DURATION_EXCEEDED')

      // 5. Valid MP4 video
      const valid = validateVideoInput({
        videoUrl: 'https://example.com/clip.mp4',
        mimeType: 'video/mp4',
        durationSeconds: 15,
      })
      expect(valid.valid).toBe(true)
    })

    it('extracts discrete frames with sequential timestamps and respects maxFrames cap', async () => {
      const video: VideoInput = {
        videoUrl: 'https://example.com/demo.mp4',
        durationSeconds: 10,
      }

      // Extract at 2 frames per second for 10 seconds -> 20 frames
      const frames = await extractVideoFrames(video, { fps: 2 })
      expect(frames.length).toBe(20)
      expect(frames[0].frameIndex).toBe(0)
      expect(frames[0].timestampSeconds).toBe(0)
      expect(frames[1].timestampSeconds).toBe(0.5)
      expect(frames[19].timestampSeconds).toBe(9.5)

      // Capped by maxFrames
      const cappedFrames = await extractVideoFrames(video, { fps: 2, maxFrames: 5 })
      expect(cappedFrames.length).toBe(5)
    })
  })

  describe('5. End-to-End Automated Video Analysis', () => {
    it('analyzes video frames and generates aggregated object counts and category scores', async () => {
      const video: VideoInput = {
        videoUrl: 'https://example.com/presentation.mp4',
        durationSeconds: 3, // 3 frames at 1 fps
      }

      const result = await analyzeVideo(video, mockProvider, {
        task: 'both',
        fps: 1,
        detectionOptions: { minConfidence: 0.5 },
      })

      expect(result.success).toBe(true)
      expect(result.totalFramesProcessed).toBe(3)
      expect(result.detections?.length).toBe(3)
      expect(result.classifications?.length).toBe(3)

      // Each frame detected 3 objects with confidence >= 0.5 (person, laptop, cup)
      expect(result.objectSummary).toEqual({
        person: 3,
        laptop: 3,
        cup: 3,
      })

      expect(result.topClasses?.['office_workspace']).toBe(0.91)
    })

    it('respects cancellation signal during video analysis', async () => {
      const video: VideoInput = {
        videoUrl: 'https://example.com/cancelled.mp4',
        durationSeconds: 10,
      }

      const controller = new AbortController()
      controller.abort()

      const result = await analyzeVideo(video, mockProvider, {
        signal: controller.signal,
      })

      expect(result.success).toBe(false)
      expect(result.errorCode).toBe('CANCELLED')
    })
  })

  describe('6. HTTP REST Vision Provider Adapter', () => {
    it('throws configuration error when VISION_SERVICE_URL is missing', async () => {
      const httpProvider = new HttpComputerVisionProvider({ serviceUrl: '' })
      await expect(
        httpProvider.detectObjects({ imageUrl: 'https://example.com/test.jpg' })
      ).rejects.toThrow('HttpComputerVisionProvider requires VISION_SERVICE_URL')
    })

    it('handles remote HTTP detection and normalizes output', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          detections: [
            {
              label: 'vehicle',
              confidence: 0.87,
              box: { x: 0.1, y: 0.2, width: 0.4, height: 0.3 },
            },
          ],
        }),
      })
      global.fetch = mockFetch

      const httpProvider = new HttpComputerVisionProvider({
        serviceUrl: 'http://localhost:8000',
        apiKey: 'test_key',
      })

      const detections = await httpProvider.detectObjects({
        imageUrl: 'https://example.com/street.jpg',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/detect',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test_key',
          }),
        })
      )
      expect(detections.length).toBe(1)
      expect(detections[0].label).toBe('vehicle')
      expect(detections[0].confidence).toBe(0.87)
      expect(detections[0].box).toEqual({ x: 0.1, y: 0.2, width: 0.4, height: 0.3 })
    })
  })
})
