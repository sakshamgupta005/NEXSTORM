/**
 * Reusable Computer Vision & Video Processing Types
 * 
 * References:
 * - Ultralytics YOLO: Object detection, classification, normalized bboxes (AGPL-3.0 / Enterprise)
 * - OpenCV: Video capture, frame sequencing, codec normalization (Apache-2.0)
 * - MediaPipe: Real-time on-device vision, landmark & tracking (Apache-2.0)
 * - Transformers.js: Zero-backend ONNX model inference (Apache-2.0)
 * - ONNX Runtime: Cross-platform hardware-accelerated ML execution (MIT)
 */

import type { BoundingBox, ImageInput } from './types'

/** Normalized object detection prediction with confidence and bounding box */
export interface DetectedObject {
  /** Class label (e.g. 'person', 'car', 'laptop') */
  label: string
  /** Confidence score between 0.0 and 1.0 */
  confidence: number
  /** Normalized bounding box where coordinates are ratios between 0.0 and 1.0 */
  box: BoundingBox
  /** Optional tracking identifier across consecutive video frames */
  trackingId?: string
}

/** Normalized image classification prediction */
export interface ClassificationResult {
  /** Class label (e.g. 'office_workspace', 'outdoor_park') */
  label: string
  /** Confidence score between 0.0 and 1.0 */
  confidence: number
}

/** Visual embedding vector output */
export interface ImageEmbeddingResult {
  /** Normalized feature vector */
  embedding: number[]
  /** Dimensionality of the embedding vector (e.g. 512, 768) */
  dimensions: number
  /** Model used to compute the embedding */
  model?: string
}

/** Options for object detection inference */
export interface DetectionOptions {
  /** Minimum confidence threshold to keep a detection (default: 0.25) */
  minConfidence?: number
  /** Maximum number of detections to return (default: 50) */
  maxDetections?: number
  /** Non-maximum suppression IoU threshold (default: 0.45) */
  nmsThreshold?: number
  /** Model identifier or version */
  model?: string
  /** Timeout in milliseconds (default: 15000) */
  timeoutMs?: number
  /** Optional cancellation signal */
  signal?: AbortSignal
}

/** Options for image classification inference */
export interface ClassificationOptions {
  /** Minimum confidence threshold (default: 0.1) */
  minConfidence?: number
  /** Top K predictions to return (default: 5) */
  topK?: number
  /** Model identifier or version */
  model?: string
  /** Timeout in milliseconds (default: 15000) */
  timeoutMs?: number
  /** Optional cancellation signal */
  signal?: AbortSignal
}

/** Options for image feature embedding */
export interface EmbeddingOptions {
  /** Model identifier or version */
  model?: string
  /** Timeout in milliseconds (default: 15000) */
  timeoutMs?: number
  /** Optional cancellation signal */
  signal?: AbortSignal
}

/** Provider-neutral computer vision provider contract */
export interface IComputerVisionProvider {
  /** Detects objects within an image with normalized bounding boxes */
  detectObjects(image: ImageInput, options?: DetectionOptions): Promise<DetectedObject[]>
  /** Classifies the dominant content or scene of an image */
  classifyImage(image: ImageInput, options?: ClassificationOptions): Promise<ClassificationResult[]>
  /** Extracts a dense feature embedding vector for visual similarity search */
  extractImageEmbedding?(image: ImageInput, options?: EmbeddingOptions): Promise<ImageEmbeddingResult>
}

// --- Video Processing Types ---

export type VideoFormat = 'mp4' | 'webm' | 'mov' | 'mkv' | 'avi'

export interface VideoInput {
  /** Video file URL or object URL */
  videoUrl?: string
  /** Raw binary buffer */
  videoBuffer?: Uint8Array
  /** MIME type (e.g. 'video/mp4', 'video/webm') */
  mimeType?: string
  /** Original filename */
  filename?: string
  /** Estimated duration in seconds if known ahead of time */
  durationSeconds?: number
}

/** Single extracted video frame */
export interface VideoFrame {
  /** Zero-indexed sequence index of the frame */
  frameIndex: number
  /** Timestamp offset in seconds from the start of the video */
  timestampSeconds: number
  /** Image payload of the extracted frame */
  image: ImageInput
}

/** Options for frame extraction */
export interface VideoExtractionOptions {
  /** Target frame rate for extraction (default: 1 frame per second) */
  fps?: number
  /** Maximum duration to process in seconds (default: 60) */
  maxDurationSeconds?: number
  /** Hard cap on total frames extracted (default: 120) */
  maxFrames?: number
  /** Maximum file size allowed in bytes (default: 50MB) */
  maxFileSizeBytes?: number
  /** Optional cancellation signal */
  signal?: AbortSignal
}

/** Options for automated video analysis */
export interface VideoAnalysisOptions extends VideoExtractionOptions {
  /** Task to run per frame: 'detection' | 'classification' | 'both' (default: 'detection') */
  task?: 'detection' | 'classification' | 'both'
  /** Detection configuration */
  detectionOptions?: DetectionOptions
  /** Classification configuration */
  classificationOptions?: ClassificationOptions
}

/** Frame detection result with timestamp */
export interface TimestampedDetection {
  frameIndex: number
  timestampSeconds: number
  objects: DetectedObject[]
}

/** Frame classification result with timestamp */
export interface TimestampedClassification {
  frameIndex: number
  timestampSeconds: number
  classifications: ClassificationResult[]
}

/** Comprehensive video analysis report */
export interface VideoAnalysisResult {
  success: boolean
  durationSeconds: number
  totalFramesProcessed: number
  detections?: TimestampedDetection[]
  classifications?: TimestampedClassification[]
  /** Frequency summary of detected object labels across the entire video */
  objectSummary?: Record<string, number>
  /** Top aggregated classification categories */
  topClasses?: Record<string, number>
  latencyMs: number
  error?: string
  errorCode?: string
}
