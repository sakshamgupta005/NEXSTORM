/**
 * Modular Integration Framework
 * 
 * Reusable, interchangeable adapter framework inspired by proven open-source projects:
 * - RAG: LlamaIndex (MIT)
 * - Document Understanding: RAGFlow (Apache-2.0)
 * - OCR: PaddleOCR (Apache-2.0)
 * - Speech: Faster-Whisper (MIT)
 * - Vision: Hugging Face Transformers (Apache-2.0)
 * - Web Search: Tavily JS (Apache-2.0)
 * - Queues: BullMQ (MIT)
 */

export * from './types'
export * from './registry'

export { inMemoryRAGDefinition, InMemoryRAGIndex, sharedInMemoryRAGIndex } from './adapters/rag'
export { mockSearchDefinition, tavilySearchDefinition } from './adapters/search'
export { inMemoryQueueDefinition, InMemoryQueue, sharedInMemoryQueue } from './adapters/queue'
export { mockOCRDefinition, httpOCRDefinition } from './adapters/ocr'
export { mockSpeechDefinition, whisperSpeechDefinition } from './adapters/speech'
export { mockVisionDefinition, huggingFaceVisionDefinition } from './adapters/vision'
export { mockDocUnderstandingDefinition, ragflowDocUnderstandingDefinition } from './adapters/doc-understanding'

import {
  IntegrationRegistry,
  defaultIntegrationRegistry,
} from './registry'
import { inMemoryRAGDefinition } from './adapters/rag'
import { mockSearchDefinition, tavilySearchDefinition } from './adapters/search'
import { inMemoryQueueDefinition } from './adapters/queue'
import { mockOCRDefinition, httpOCRDefinition } from './adapters/ocr'
import { mockSpeechDefinition, whisperSpeechDefinition } from './adapters/speech'
import { mockVisionDefinition, huggingFaceVisionDefinition } from './adapters/vision'
import { mockDocUnderstandingDefinition, ragflowDocUnderstandingDefinition } from './adapters/doc-understanding'

let initialized = false

/**
 * Returns the default IntegrationRegistry populated with all standard mock and service adapters.
 */
export function getIntegrationRegistry(): IntegrationRegistry {
  if (!initialized) {
    defaultIntegrationRegistry
      .register(inMemoryRAGDefinition)
      .register(mockSearchDefinition)
      .register(tavilySearchDefinition)
      .register(inMemoryQueueDefinition)
      .register(mockOCRDefinition)
      .register(httpOCRDefinition)
      .register(mockSpeechDefinition)
      .register(whisperSpeechDefinition)
      .register(mockVisionDefinition)
      .register(huggingFaceVisionDefinition)
      .register(mockDocUnderstandingDefinition)
      .register(ragflowDocUnderstandingDefinition)
    initialized = true
  }
  return defaultIntegrationRegistry
}
