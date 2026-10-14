# Modular Integration Framework & Open-Source References

This guide documents the **Modular Integration Framework** for the Hackathon Starter, designed to integrate specialized AI and infrastructure capabilities through clean, interchangeable adapters.

Following the skeleton-first philosophy:
> **The starter serves the future product. The future product does not serve the starter.**
> All integrations are strictly optional, dependency-isolated, and accompanied by zero-cost mock/in-memory implementations so hackathon teams can build and test offline without paid API keys, GPU hardware, or external databases.

---

## Architecture Overview

The integration layer resides in [`src/lib/integrations/`](file:///c:/Users/rspma/Downloads/Hackathon-starter/src/lib/integrations/):
- [`types.ts`](file:///c:/Users/rspma/Downloads/Hackathon-starter/src/lib/integrations/types.ts): Standard TypeScript contracts, capability categories, and normalized error models (`NOT_CONFIGURED`, `NOT_REGISTERED`, `TIMEOUT`, `CANCELLED`, `INVALID_INPUT`).
- [`registry.ts`](file:///c:/Users/rspma/Downloads/Hackathon-starter/src/lib/integrations/registry.ts): `IntegrationRegistry` coordinating registration, category indexing, lazy adapter initialization, timeout enforcement, `AbortSignal` cancellation, and zero-exception execution.
- [`adapters/`](file:///c:/Users/rspma/Downloads/Hackathon-starter/src/lib/integrations/adapters/): Thin adapters matching each capability category with both in-memory/mock and remote HTTP implementations.
- [`index.ts`](file:///c:/Users/rspma/Downloads/Hackathon-starter/src/lib/integrations/index.ts): Central barrel and `getIntegrationRegistry()` preloaded with default capabilities.

```typescript
import { getIntegrationRegistry } from '@/lib/integrations'

const registry = getIntegrationRegistry()

// Execute capability safely — never throws uncaught exceptions
const result = await registry.execute('search:mock', {
  query: 'Next.js 16 App Router',
  maxResults: 3,
})

if (result.success) {
  console.log(result.data.results)
} else {
  console.warn(result.errorDetail?.code, result.error)
}
```

---

## Capability Reference Catalogue

### 1. RAG & Document Retrieval
- **Status**: `READY` (In-memory engine implemented; external vector DB adapters pluggable)
- **Reference Repository**: [`run-llama/llama_index`](https://github.com/run-llama/llama_index) (and `LlamaIndexTS`)
- **License**: MIT
- **What it enables**: Sliding-window text chunking, document indexing, and semantic similarity search for context injection into LLM prompts.
- **Required Environment Variables**: None for in-memory mode. (Optional: `PINECONE_API_KEY` or Supabase pgvector if persisting embeddings).
- **Optional Dependencies**: `@llamaindex/core` (if advanced graph indexing or node parsers are needed).
- **How to enable & use**:
  ```typescript
  import { sharedInMemoryRAGIndex, getIntegrationRegistry } from '@/lib/integrations'

  // 1. Index documents in-memory
  sharedInMemoryRAGIndex.addDocuments({
    documents: [{ id: 'doc-1', text: 'Supabase provides real-time postgres subscriptions.' }],
    chunkSize: 150,
    chunkOverlap: 25,
  })

  // 2. Query through registry
  const result = await getIntegrationRegistry().execute('rag:in-memory', {
    query: 'postgres subscriptions',
    topK: 3,
  })
  ```
- **Local / Mock Alternative**: `rag:in-memory` provides zero-dependency word-frequency & token-overlap scoring.
- **Limitations & Licensing**: In-memory storage is ephemeral and cleared on process restart. MIT license allows unrestricted commercial and hackathon reuse.

---

### 2. Advanced Document Understanding & Structural Parsing
- **Status**: `READY` (Mock parser implemented; RAGFlow HTTP adapter ready)
- **Reference Repository**: [`infiniflow/ragflow`](https://github.com/infiniflow/ragflow)
- **License**: Apache-2.0
- **What it enables**: Deep document parsing, template/layout analysis, section extraction, and structured tabular data extraction from PDFs and documents.
- **Required Environment Variables**: `RAGFLOW_SERVICE_URL` and optional `RAGFLOW_API_KEY`.
- **Optional Dependencies**: None (communicates via native `fetch`).
- **How to enable & use**:
  ```typescript
  // Uses doc_understanding:mock in development, or doc_understanding:ragflow in production
  const result = await registry.execute('doc_understanding:mock', {
    documentUrl: 'https://example.com/quarterly-report.pdf',
    extractTables: true,
  })
  ```
- **Local / Mock Alternative**: `doc_understanding:mock` returns pre-structured sections and tables for layout verification.
- **Limitations & Licensing**: Deep OCR-based layout analysis requires deploying RAGFlow's Docker stack if real PDF rendering is required. Apache-2.0 license permits redistribution and modification with notice preservation.

---

### 3. OCR & Document Intelligence Toolkit
- **Status**: `READY` (Full toolkit implemented in [`src/lib/vision/`](file:///c:/Users/rspma/Downloads/Hackathon-starter/src/lib/vision/))
- **Reference Repositories**:
  - [`PaddlePaddle/PaddleOCR`](https://github.com/PaddlePaddle/PaddleOCR) (Apache-2.0): Text detection, multilingual recognition, table and layout parsing.
  - [`tesseract-ocr/tesseract`](https://github.com/tesseract-ocr/tesseract) (Apache-2.0): Established local/containerized OCR engine.
  - [`docling-project/docling`](https://github.com/docling-project/docling) (MIT): Advanced document conversion and structural chunking.
  - [`datalab-to/marker`](https://github.com/datalab-to/marker) (GPL-3.0 / PolyForm): High-accuracy PDF to markdown conversion.
  - [`opencv/opencv`](https://github.com/opencv/opencv) (Apache-2.0): Image preprocessing and contrast enhancement patterns.
- **What it enables**: Provider-neutral OCR, bounding box coordinates (`{ x, y, width, height }`), word/line confidence, document extraction, and seamless RAG pipeline bridge adapter.
- **Required Environment Variables**: None for `mock`. Optional `OCR_SERVICE_URL` (PaddleOCR) or `TESSERACT_SERVICE_URL` (Tesseract service).
- **Optional Dependencies**: None in Node.js (uses pure TypeScript byte sniffing and REST payload exchange).
- **How to enable & use**:
  ```typescript
  import { executeOCR, extractDocument, toRAGDocuments } from '@/lib/vision'
  import { splitDocuments, InMemoryVectorStore } from '@/lib/rag'

  // 1. Direct OCR with coordinates and confidence
  const ocr = await executeOCR(
    { base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', mimeType: 'image/png' },
    { provider: 'mock', language: 'en', returnBoundingBoxes: true }
  )

  // 2. Composable Document Extraction
  const doc = await extractDocument(
    { base64: '...', mimeType: 'application/pdf' },
    { ocrProvider: 'mock', maxPages: 10 }
  )

  // 3. Bridge to RAG pipeline (Part 4.2)
  const ragDocs = toRAGDocuments(doc)
  const chunks = splitDocuments(ragDocs, { chunkSize: 200, chunkOverlap: 25 })
  const store = new InMemoryVectorStore()
  await store.addChunks(chunks)
  ```
- **Local / Mock Alternative**: `mock` OCR returns deterministic lines, bounding boxes, and 0.98 confidence scores without network or native dependencies.
- **Limitations & Licensing**: Real PaddleOCR/Tesseract requires a self-hosted microservice or container. Apache-2.0 and MIT licenses permit unrestricted hackathon use.

---

### 4. Speech Recognition & Transcription
- **Status**: `READY` (Mock speech implemented; Faster-Whisper HTTP adapter ready)
- **Reference Repository**: [`SYSTRAN/faster-whisper`](https://github.com/SYSTRAN/faster-whisper)
- **License**: MIT
- **What it enables**: Speech-to-text audio transcription, timestamped segment generation, and language detection.
- **Required Environment Variables**: `WHISPER_SERVICE_URL` (or `OPENAI_API_KEY` / `GROQ_API_KEY` for hosted Whisper).
- **Optional Dependencies**: None (uses REST audio payload exchange).
- **How to enable & use**:
  ```typescript
  import { transcribeAudio, synthesizeSpeech, runVoicePipeline } from '@/lib/speech'

  // 1. Transcribe speech
  const stt = await transcribeAudio({ audioBase64: '...' }, { provider: 'mock' })

  // 2. Synthesize speech
  const tts = await synthesizeSpeech({ text: 'Task completed successfully.' })

  // 3. Composable Voice Pipeline (Audio -> STT -> AI Processing -> TTS)
  const pipeline = await runVoicePipeline({
    audio: { audioBase64: '...' },
    processText: async (prompt) => `Processed: ${prompt}`,
  })
  ```
- **Local / Mock Alternative**: `mock` STT provides instant timestamped transcript segments and `mock` TTS returns immediate playable audio chime data without network requests.
- **Limitations & Licensing**: Local Faster-Whisper, Kokoro, and Piper execution require lightweight external containers or service endpoints (`WHISPER_SERVICE_URL`, `KOKORO_SERVICE_URL`, `PIPER_SERVICE_URL`). MIT and Apache-2.0 licenses permit free commercial use.

---

### 5. AI Vision & Multimodal Understanding
- **Status**: `READY` (Toolkit implemented in [`src/lib/vision/vision-ai.ts`](file:///c:/Users/rspma/Downloads/Hackathon-starter/src/lib/vision/vision-ai.ts))
- **Reference Repositories**:
  - [`huggingface/transformers.js`](https://github.com/huggingface/transformers.js) (Apache-2.0): Browser-side and ONNX model runtime reference.
  - [`huggingface/transformers`](https://github.com/huggingface/transformers) (Apache-2.0): Multimodal VQA and visual captioning pipelines.
- **What it enables**: Image description, Visual Question Answering (VQA), visual summarization, and structured information extraction validated against Zod schemas. Supports up to 5 images per request and explicitly verifies provider vision capabilities (`isVisionSupported`).
- **Required Environment Variables**: `OPENAI_API_KEY` or `GEMINI_API_KEY` (None needed for `mock`).
- **Optional Dependencies**: None (uses unified AI client and native fetch).
- **How to enable & use**:
  ```typescript
  import { processVisionRequest, isVisionSupported } from '@/lib/vision'
  import { z } from 'zod'

  // Structured extraction with Zod schema
  const InvoiceSchema = z.object({
    title: z.string(),
    totalAmount: z.number(),
    currency: z.string(),
  })

  const result = await processVisionRequest({
    provider: 'mock', // or 'gemini', 'openai'
    images: [{ base64: '...', mimeType: 'image/jpeg' }],
    task: 'extract',
    schema: InvoiceSchema,
  })

  if (result.success) {
    console.log(result.structuredData) // Typed as z.infer<typeof InvoiceSchema>
  }
  ```
- **Local / Mock Alternative**: `mock` provider generates deterministic descriptions, VQA answers, and valid schema matches without external network or API costs.
- **Limitations & Licensing**: Text-only LLM models (e.g. Groq) return `PROVIDER_DOES_NOT_SUPPORT_VISION`. Cloud vision APIs have per-token/per-image pricing. Apache-2.0 license.

---

### 6. Web Search & External Data Toolkit
- **Status**: `READY` (Full toolkit implemented in [`src/lib/search/`](file:///c:/Users/rspma/Downloads/Hackathon-starter/src/lib/search/))
- **Reference Repositories**:
  - [`tavily-ai/tavily-js`](https://github.com/tavily-ai/tavily-js) (Apache-2.0): Agentic web search API returning clean snippets and synthesized answers.
  - [`exa-labs/exa-js`](https://github.com/exa-labs/exa-js) (MIT / Apache-2.0): Neural embeddings-based search and link discovery.
  - [`firecrawl/firecrawl`](https://github.com/firecrawl/firecrawl) (AGPL-3.0 / Client MIT): Clean web scraping, markdown conversion, and boilerplate stripping.
  - [`langchain-ai/langchainjs`](https://github.com/langchain-ai/langchainjs) (MIT): Source-grounded document loaders and citation chains.
- **What it enables**: Provider-neutral web search, anti-SSRF URL filtering, HTML boilerplate stripping, traceable citation QA, and drop-in agent tools (`web_search`, `fetch_webpage`, `extract_page_content`).
- **Required Environment Variables**: None for `mock`. `TAVILY_API_KEY` for live Tavily search, `EXA_API_KEY` for live Exa search.
- **Optional Dependencies**: None (uses native `fetch` and pure TypeScript parsing).
- **How to enable & use**:
  ```typescript
  import {
    executeSearch,
    fetchWebpage,
    synthesizeGroundedAnswer,
    registerWebTools
  } from '@/lib/search'
  import { ToolRegistry } from '@/lib/agent/tools'

  // 1. Provider-neutral search
  const search = await executeSearch({
    query: 'Next.js 16 Turbopack',
    provider: 'mock', // or 'tavily', 'exa'
    maxResults: 3,
    includeDomains: ['nextjs.org'],
  })

  // 2. Safe webpage retrieval with anti-SSRF and boilerplate stripping
  const page = await fetchWebpage({
    url: 'https://nextjs.org/docs',
    maxContentLength: 5000,
  })

  // 3. Grounded answer synthesis with traceable citations [1], [2]
  const grounded = await synthesizeGroundedAnswer({
    query: 'What are the main Next.js 16 features?',
    searchOptions: { provider: 'mock' },
  })
  console.log(grounded.answer)
  console.log(grounded.citations) // Array of { sourceIndex, title, url, snippet }

  // 4. Mount agent tools onto ToolRegistry
  const registry = new ToolRegistry()
  registerWebTools(registry, { config: { defaultSearchProvider: 'mock' } })
  ```
- **Local / Mock Alternative**: `mock` search contains a deterministic local dataset with domain, keyword, and recency filtering for 100% offline testing.
- **Limitations & Licensing**: Live web search requires a Tavily or Exa API key. Cloud instance metadata and private subnets are permanently blocked by SSRF defense. Apache-2.0 and MIT licenses permit unrestricted hackathon use.

---

### 7. Background Jobs & Asynchronous Queues
- **Status**: `READY` (In-memory priority queue implemented; BullMQ adapter pattern defined)
- **Reference Repository**: [`taskforcesh/bullmq`](https://github.com/taskforcesh/bullmq)
- **License**: MIT
- **What it enables**: Task queuing, priority scheduling, lifecycle tracking (`waiting`, `active`, `completed`, `failed`), and retry management.
- **Required Environment Variables**: `REDIS_URL` if connecting BullMQ with Redis.
- **Optional Dependencies**: `bullmq`, `ioredis` (if connecting to external Redis instance).
- **How to enable & use**:
  ```typescript
  import { sharedInMemoryQueue, getIntegrationRegistry } from '@/lib/integrations'

  // Submit a job
  const jobResult = await getIntegrationRegistry().execute('queue:in-memory', {
    name: 'generate-report',
    data: { reportId: 42 },
    priority: 5,
  })

  // Worker loop
  await sharedInMemoryQueue.processNext(async (job) => {
    return { status: 'generated', id: job.data.reportId }
  })
  ```
- **Local / Mock Alternative**: `queue:in-memory` provides full queue semantics without Redis or background daemon processes.
- **Limitations & Licensing**: In-memory queues do not persist across serverless function instances or process restarts. MIT license.

---

### 8. Reusable Authentication & Authorization Toolkit (RBAC/ABAC)
- **Status**: `READY` (Full toolkit implemented in [`src/lib/auth/`](file:///c:/Users/rspma/Downloads/Hackathon-starter/src/lib/auth/))
- **Reference Repositories**:
  - [`better-auth/better-auth`](https://github.com/better-auth/better-auth) (Apache-2.0): TypeScript-first modular auth framework and session patterns.
  - [`nextauthjs/next-auth`](https://github.com/nextauthjs/next-auth) (ISC): Next.js session management, OAuth callback exchange, and cookie configuration.
  - [`lucia-auth/lucia`](https://github.com/lucia-auth/lucia) (MIT): Session lifecycle and database session schema reference (deprecated in 2024; evaluated and modernized).
  - [`stalniy/casl`](https://github.com/stalniy/casl) (MIT): Isomorphic declarative ability and permission engine (`can(action, subject)`).
- **What it enables**: Complete user authentication, scrypt password hashing, session tokens, cookie security, declarative RBAC/ABAC rules, server-side guards, and frontend ability components.
- **Required Environment Variables**: None for `mock` or local sessions. Supabase credentials (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) if using Supabase auth.
- **Optional Dependencies**: None (uses Node.js standard `crypto` for scrypt hashing and timing-safe comparison).
- **How to enable & use**:
  ```typescript
  import {
    hashPassword,
    verifyPassword,
    createSession,
    defineAbilityFor,
    requireRole,
    requirePermission,
    AuthProvider,
    Can,
    ProtectedRoute,
  } from '@/lib/auth'

  // 1. Password hashing & verification
  const hash = await hashPassword('UserPassword123')
  const isValid = await verifyPassword('UserPassword123', hash)

  // 2. CASL-style Ability definition
  const user = { id: 'usr_1', email: 'alice@test.com', role: 'user' }
  const ability = defineAbilityFor(user)

  console.log(ability.can('read', 'Project')) // true
  console.log(ability.can('update', 'Project', { ownerId: 'usr_1' })) // true (own resource)
  console.log(ability.can('update', 'Project', { ownerId: 'usr_2' })) // false (other's resource)

  // 3. Server-side API / Server Action Guards
  const roleCheck = requireRole(user, 'admin')
  if (!roleCheck.allowed) {
    // Returns 403 Forbidden
  }

  const permCheck = requirePermission(ability, 'delete', 'Project', { ownerId: 'usr_1' })
  if (!permCheck.allowed) {
    // Returns 403 Forbidden
  }
  ```
- **Declarative Frontend Components**:
  ```tsx
  import { Can, ProtectedRoute, useAuth, useAbility } from '@/lib/auth'

  export function ProjectCard({ project }: { project: any }) {
    return (
      <div>
        <h3>{project.title}</h3>
        {/* Hide/show UI based on user's ABAC permissions */}
        <Can I="delete" an="Project" this={project}>
          <button onClick={() => deleteProject(project.id)}>Delete</button>
        </Can>
      </div>
    )
  }

  // Protect whole page or panel
  export function AdminSettings() {
    return (
      <ProtectedRoute roles={['admin']} fallback={<p>Access Denied</p>}>
        <AdminControls />
      </ProtectedRoute>
    )
  }
  ```
- **Local / Mock Alternative**: `MockAuthProvider` provides in-memory users (`admin@example.com`, `user@example.com`, `editor@example.com`, password: `Password123`), session validation, and registration for 100% offline development and automated testing.
- **Limitations & Licensing**: In-memory session store is ephemeral; persistent sessions across multi-instance serverless deployments should plug a database adapter (e.g. Supabase, PostgreSQL, or Redis). Apache-2.0 and MIT licenses permit commercial and hackathon reuse.

---

### 7. Database, Storage & Caching Layer
- **Status**: `READY` (In-memory implementations active; Supabase & Redis adapters pluggable)
- **Reference Repositories**:
  - **Prisma**: [`prisma/prisma`](https://github.com/prisma/prisma) (Apache-2.0) — Typed data modeling, migrations, and repository access conventions.
  - **Drizzle ORM**: [`drizzle-team/drizzle-orm`](https://github.com/drizzle-team/drizzle-orm) (Apache-2.0) — Lightweight, zero-overhead SQL-like querying and transactions.
  - **Supabase JavaScript**: [`supabase/supabase-js`](https://github.com/supabase/supabase-js) (MIT) — PostgREST database queries, auth, and S3-compatible cloud storage.
  - **Redis**: [`redis/redis`](https://github.com/redis/redis) (RSALv2 / SSPLv1) & Upstash Redis REST — Key-value caching, TTL expiration, and atomic operations.
  - **MinIO**: [`minio/minio`](https://github.com/minio/minio) (AGPL-3.0) — S3-compatible object storage API reference, signed URLs, and bucket management.
- **What it enables**: Complete data persistence, secure file uploads/retrieval, and high-performance caching for any hackathon problem statement without rebuilding infrastructure:
  - **Database Abstraction**: `IRepository<T>`, `InMemoryDatabaseAdapter` (snapshot-based atomic transaction rollback), `checkDatabaseHealth` diagnostics, and `MigrationManager` with PostgreSQL starter schemas.
  - **File Storage**: `IFileStorageAdapter`, `LocalStorageAdapter`, `SupabaseStorageAdapter`, anti-directory traversal guard (`sanitizeStoragePath`), collision-resistant safe path generator (`generateSafeStoragePath`), file size & MIME validators, HMAC signed URLs, and authorization enforcement (`verifyStorageAccess`).
  - **Caching**: `ICache`, `InMemoryCache`, `RedisCacheAdapter` (REST-based via native `fetch`), TTL expiration, cache-key namespacing, and non-crashing fallback via `getOrSet`.
- **Required Environment Variables**: None for local/test mode. Optional:
  - `DATABASE_URL`: PostgreSQL connection string (automatically masked in logs).
  - `NEXT_PUBLIC_SUPABASE_URL` & `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Cloud database and storage.
  - `UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN` (or `REDIS_REST_URL` & `REDIS_REST_TOKEN`): Remote Redis cache.
- **How to enable & use**:
  ```typescript
  import { sharedDatabaseAdapter } from '@/lib/database'
  import { sharedFileStorage } from '@/lib/storage'
  import { sharedCache } from '@/lib/cache'

  // 1. Typed Database Repository & Atomic Transactions
  interface Project {
    id: string
    title: string
    status: string
    ownerId: string
  }

  const projectRepo = sharedDatabaseAdapter.getRepository<Project>('projects')
  await projectRepo.create({ id: 'p1', title: 'AI Assistant', status: 'active', ownerId: 'usr_1' })

  // Atomic transaction with automatic snapshot rollback on failure
  await sharedDatabaseAdapter.transaction(async (tx) => {
    const repo = tx.getRepository<Project>('projects')
    await repo.update('p1', { status: 'published' })
    // If an error is thrown here, all changes automatically revert!
  })

  // 2. Safe File Storage & Access Boundaries
  const fileBuffer = Buffer.from('Report content...')
  const uploadResult = await sharedFileStorage.upload(fileBuffer, 'quarterly-report.pdf', {
    ownerId: 'usr_1',
    isPublic: false,
  })

  // Generate 15-minute temporary signed download URL
  const downloadUrl = await sharedFileStorage.getSignedUrl(uploadResult.file!.path, {
    expiresInSeconds: 900,
  })

  // 3. Resilient Caching with Namespaces
  const cachedProjects = sharedCache.namespace('projects')
  const data = await cachedProjects.getOrSet(
    'published_list',
    async () => projectRepo.find({ status: 'published' }),
    300 // 5-minute TTL
  )
  ```
- **Local / Mock Alternative**: `InMemoryDatabaseAdapter`, `LocalStorageAdapter`, and `InMemoryCache` operate completely in-memory with zero cloud or native C++ dependencies.
- **Limitations & Considerations**: In-memory stores are ephemeral and scoped to the active Node.js process. In multi-container or serverless deployments, configure `DATABASE_URL` or Supabase for persistent data storage across server restarts.

---

### 8. Maps, Geolocation & Routing Layer
- **Status**: `READY` (SSR-safe React map component, deterministic math, and mock providers active; OSM & OSRM pluggable)
- **Reference Repositories**:
  - **Leaflet**: [`Leaflet/Leaflet`](https://github.com/Leaflet/Leaflet) (BSD-2-Clause) — Web Mercator projection formulas, coordinate projection, markers, and popup behaviors.
  - **MapLibre GL JS**: [`maplibre/maplibre-gl-js`](https://github.com/maplibre/maplibre-gl-js) (BSD-3-Clause) — Vector route layer rendering and accessible interactive viewport controls.
  - **React Leaflet**: [`PaulLeCam/react-leaflet`](https://github.com/PaulLeCam/react-leaflet) (Hippocratic / MIT) — Component abstractions, props contracts, and React event models.
  - **OSRM**: [`Project-OSRM/osrm-backend`](https://github.com/Project-OSRM/osrm-backend) (BSD-2-Clause) — Multi-modal route calculation protocols (car, bike, foot), polyline geometry, and turn-by-turn steps.
  - **Turf.js**: [`Turfjs/turf`](https://github.com/Turfjs/turf) (MIT) — Haversine distance, initial compass bearing, destination point projection, and bounding box calculations.
- **What it enables**: Interactive maps, user location acquisition, geocoding, distance math, route calculations, and nearby POI search for any hackathon challenge:
  - **Geospatial Math**: Pure TypeScript Haversine distance calculations (`calculateDistance`), bearing azimuth (`calculateBearing`), and bounding box enclosing (`calculateBoundingBox`).
  - **Browser Geolocation**: `requestGeolocation` acquiring location only on explicit user consent (never silent), normalizing permission denials, timeouts, and unavailabilities.
  - **Geocoding**: `IGeocodingProvider` with `MockGeocodingProvider` (deterministic global tech hubs) and `NominatimGeocodingProvider` (OpenStreetMap).
  - **Routing**: `IRoutingProvider` supporting driving, walking, and cycling travel modes with `MockRoutingProvider` and `OSRMRoutingProvider`.
  - **Nearby Search**: `INearbySearchProvider` with `MockNearbySearchProvider` and `OverpassNearbySearchProvider` (OSM Overpass API).
  - **Interactive Map Components**: `<InteractiveMap />` (100% SSR-safe, markers, popups, route polylines, zoom/pan controls, click-to-pin) and `<LocationPicker />` (search input, "Use My Location" explicit consent button, and interactive map preview).
- **Tile Usage Policies & Licensing**:
  - OpenStreetMap standard tiles (`tile.openstreetmap.org`) require appropriate attribution (`© OpenStreetMap contributors`) and forbid bulk pre-downloading or heavy automated scraping.
  - Commercial or heavy deployments should configure a dedicated vector tile provider (e.g. Mapbox, MapTiler, Protomaps, or self-hosted tile server).
- **How to enable & use**:
  ```tsx
  import { calculateDistance, formatDistance, sharedRoutingProvider } from '@/lib/geo'
  import { InteractiveMap, LocationPicker } from '@/components/geo'

  // 1. Calculate distances & routes
  const sf = { lat: 37.7749, lng: -122.4194 }
  const oakland = { lat: 37.8044, lng: -122.2712 }
  const distanceKm = calculateDistance(sf, oakland, 'kilometers')
  const route = await sharedRoutingProvider.calculateRoute(sf, oakland, { mode: 'driving' })

  // 2. Render interactive map with markers and route polyline
  export function DispatchMap() {
    return (
      <InteractiveMap
        center={sf}
        zoom={12}
        markers={[
          { id: '1', position: sf, title: 'Origin Hub', color: '#3b82f6' },
          { id: '2', position: oakland, title: 'Delivery Destination', color: '#10b981' },
        ]}
        routeCoordinates={route.coordinates}
        height={400}
      />
    )
  }

  // 3. Location picker form component
  export function SelectAddressForm() {
    return (
      <LocationPicker
        label="Set Pickup Point"
        onLocationSelect={(coords, address) => {
          console.log('Selected:', coords, address)
        }}
      />
    )
  }
  ```
- **Local / Mock Alternative**: `MockGeocodingProvider`, `MockRoutingProvider`, and `MockNearbySearchProvider` operate 100% offline with zero network calls and zero paid credentials.
- **Privacy & Security Constraints**:
  - Precision coordinates are never stored to persistent databases or logged without user consent.
  - Browser geolocation is never requested on module load or page boot.
  - Third-party geocoding and routing endpoints are accessed with timeouts (`AbortSignal.timeout(3000)`) and safe fallbacks.

---

### 9. Payments & Webhook Infrastructure
- **Status**: `READY` (In-memory mock simulator & signature verification active; Stripe & Razorpay pluggable)
- **Reference Repositories**:
  - **Stripe Node.js SDK**: [`stripe/stripe-node`](https://github.com/stripe/stripe-node) (Apache-2.0) — Checkout Sessions, PaymentIntents, webhook signature formats (`t=...,v1=...`), and tolerance checking.
  - **Razorpay Node.js SDK**: [`razorpay/razorpay-node`](https://github.com/razorpay/razorpay-node) (MIT) — Order creation, payment status polling, and HMAC-SHA256 signature verification.
  - **Svix**: [`svix/svix-webhooks`](https://github.com/svix/svix-webhooks) (Apache-2.0) — Webhook event lifecycle, timestamp anti-replay verification, and payload signing standards.
  - **Standard Webhooks**: [`standard-webhooks/standard-webhooks`](https://github.com/standard-webhooks/standard-webhooks) (Apache-2.0) — Universal webhook specification, message IDs, and signature headers.
- **What it enables**: Provider-neutral checkout flows, status polling, and cryptographic webhook listeners for monetization, subscriptions, or external event synchronization:
  - **Payment Validation**: Integer minor unit validation (cents/paise), ISO-4217 currency enforcement, reference ID sanitization, and monetary formatting.
  - **Checkout Abstraction**: `createCheckoutSession` creating hosted checkout URLs, linking to application reference IDs (`order_123`).
  - **Cryptographic Verification**: `verifyStripeSignature`, `verifyHmacSha256Signature`, and `verifyStandardWebhookSignature` using constant-time comparison (`timingSafeEqualStrings`).
  - **Idempotency Guard**: `InMemoryIdempotencyStore` tracking processed event IDs to prevent duplicate webhook delivery from repeating side-effects.
  - **Webhook Pipeline**: `IdempotentWebhookHandler` with event-specific listeners (`on('checkout.session.completed', ...)`) and wildcard listeners (`on('*', ...)`).
- **Required Environment Variables**: None for offline/mock development. Optional:
  - `STRIPE_SECRET_KEY`: Stripe API secret key (e.g. `sk_test_...` or `sk_live_...`).
  - `STRIPE_WEBHOOK_SECRET`: Stripe endpoint signing secret (e.g. `whsec_...`).
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: Client-side publishable key for Elements/Checkout redirects.
  - `RAZORPAY_KEY_ID` & `RAZORPAY_KEY_SECRET`: Razorpay credentials.
- **How to enable & use**:
  ```typescript
  import {
    sharedPaymentProvider,
    sharedWebhookHandler,
    formatCurrencyAmount,
  } from '@/lib/payments'

  // 1. Create a checkout session
  const session = await sharedPaymentProvider.createCheckoutSession({
    referenceId: 'order_hck_2026',
    amount: 2500, // $25.00
    currency: 'USD',
    customerEmail: 'developer@example.com',
    successUrl: 'https://myapp.com/checkout/success',
    cancelUrl: 'https://myapp.com/checkout/cancel',
  })
  console.log('Redirect user to:', session.checkoutUrl)

  // 2. Query status programmatically (Never trust frontend query parameters alone!)
  const status = await sharedPaymentProvider.getPaymentStatus(session.sessionId)
  if (status.status === 'succeeded') {
    // Fulfill order
  }

  // 3. Register idempotent webhook event listener
  sharedWebhookHandler.on('checkout.session.completed', async (event) => {
    const data = event.data as Record<string, any>
    const orderId = data.client_reference_id
    console.log(`Payment confirmed for ${orderId}`)
    // Safe: duplicates will automatically be suppressed by idempotency store!
  })

  // 4. In your Route Handler (/app/api/webhooks/stripe/route.ts):
  export async function POST(req: Request) {
    const rawBody = await req.text()
    const signature = req.headers.get('stripe-signature') || ''
    const secret = process.env.STRIPE_WEBHOOK_SECRET || ''

    const result = await sharedWebhookHandler.handleStripeWebhook(rawBody, signature, secret)
    return Response.json(result, { status: result.status === 'failed' ? 400 : 200 })
  }
  ```
- **Local / Mock Alternative**: `MockPaymentProvider` generates mock checkout URLs, allows simulating transitions via `simulatePaymentStatus('mock_cs_...', 'succeeded')`, and creates valid mock webhook events without Stripe keys.
- **Security Guardrails**:
  - Raw request bodies must be passed into verifiers before JSON parsing.
  - Never store raw card numbers, CVVs, or payment secrets in project databases.
  - Always verify signatures and check idempotency before fulfilling purchases or granting user credits.

---

### 10. Background Jobs & Multi-Step Workflows
- **Status**: `READY`
- **Reference Repositories**:
  - [`taskforcesh/bullmq`](https://github.com/taskforcesh/bullmq) (MIT) — Job lifecycle, queues, workers, concurrency, exponential backoff.
  - [`inngest/inngest`](https://github.com/inngest/inngest) (Apache-2.0 / BSL) — Step functions, durable executions, memoized step replays.
  - [`temporalio/temporal`](https://github.com/temporalio/temporal) (MIT) — Workflow checkpoints, failure isolation, side-effect compensation.
  - [`triggerdotdev/trigger.dev`](https://github.com/triggerdotdev/trigger.dev) (Apache-2.0) — Task execution, scheduling, real-time progress.
- **Location**: [`src/lib/jobs/`](file:///c:/Users/rspma/Downloads/Hackathon-starter/src/lib/jobs/) (`types.ts`, `queue.ts`, `scheduler.ts`, `workflow.ts`, `index.ts`)
- **Required Environment Variables**: None for local development. (Optional: `REDIS_URL` if connecting a distributed Redis worker for BullMQ).
- **How to enable & use**:
  ```typescript
  import {
    LocalJobQueue,
    sharedJobQueue,
    JobWorkflowBuilder,
    JobWorkflowEngine,
    JobScheduler,
  } from '@/lib/jobs'

  // 1. Register a typed background job handler
  sharedJobQueue.registerHandler<{ documentId: string }, { summary: string }>(
    'summarize_document',
    async (job, ctx) => {
      ctx.log(`Processing document ${job.data.documentId}`)
      await ctx.updateProgress(25, 'Downloading document')
      // Long-running async task...
      await ctx.updateProgress(100, 'Finished summary')
      return { summary: 'Document summary text...' }
    },
    { timeoutMs: 30000, priority: 5 }
  )

  // 2. Enqueue a job with submission idempotency & retry safeguards
  const job = await sharedJobQueue.enqueue(
    'summarize_document',
    { documentId: 'doc_42' },
    {
      idempotencyKey: 'summarize_doc_42',
      isIdempotent: true,
      retryPolicy: { maxRetries: 2, strategy: 'exponential', backoffMs: 1000 },
    }
  )

  // 3. Composable multi-step workflow pipeline with checkpoints
  const steps = new JobWorkflowBuilder<{ rawInput: string; processed?: string; aiResult?: string }>()
    .step({
      id: 'validate',
      name: 'Validate Input',
      execute: (ctx) => ({ success: Boolean(ctx.context.rawInput) }),
    })
    .step({
      id: 'process',
      name: 'Clean Data',
      execute: (ctx) => ({
        success: true,
        patchContext: { processed: ctx.context.rawInput.trim() },
      }),
    })
    .step({
      id: 'call_ai',
      name: 'Execute AI Step',
      execute: (ctx) => ({
        success: true,
        patchContext: { aiResult: `AI Output for: ${ctx.context.processed}` },
      }),
    })
    .build()

  const workflowEngine = new JobWorkflowEngine({
    workflowId: 'wf_doc_pipeline_1',
    initialContext: { rawInput: '  hackathon brief  ' },
    steps,
  })

  const outcome = await workflowEngine.run()
  console.log('Workflow status:', outcome.status, outcome.context)
  ```
- **Recurring Schedules**:
  ```typescript
  import { sharedJobScheduler, sharedJobQueue } from '@/lib/jobs'

  sharedJobScheduler.setQueue(sharedJobQueue)
  sharedJobScheduler.registerRecurring({
    id: 'nightly_data_sync',
    name: 'data_sync',
    data: { syncAll: true },
    cronExpression: '0 2 * * *', // Every day at 2:00 AM
  })
  sharedJobScheduler.start()
  ```
- **Infrastructure Requirements & Limitations**:
  - The built-in `LocalJobQueue` operates 100% in-memory without requiring Redis, Docker, or external cloud workers.
  - **Limitation**: In-memory jobs and idempotency records do not survive Node.js process restarts.
  - For horizontally scaled serverless deployments (Vercel/Cloudflare), use webhook triggers or connect a backing database/Redis queue.
- **Safety Directives**:
  - Non-idempotent operations (payment charges, external emails, SMS) reject automatic retries unless explicitly declared `isIdempotent: true` or `retryPolicy.nonIdempotentSafe: true`.
  - Mutating steps record `uncertainStepId` in checkpoints to detect and prevent duplicate external side-effects upon resumption.

---

### 11. Notifications & Messaging Toolkit
- **Status**: `READY`
- **Reference Repositories**:
  - [`resend/resend-node`](https://github.com/resend/resend-node) (MIT) — Clean REST transactional email payload, batch send.
  - [`nodemailer/nodemailer`](https://github.com/nodemailer/nodemailer) (MIT) — Transport abstractions, plain text fallback, sender identity.
  - [`novuhq/novu`](https://github.com/novuhq/novu) (MIT) — Multi-channel workflows, user preferences, template variables.
  - [`socketio/socket.io`](https://github.com/socketio/socket.io) (MIT) — Realtime in-app notification emission.
- **Location**: [`src/lib/notifications/`](file:///c:/Users/rspma/Downloads/Hackathon-starter/src/lib/notifications/) (`types.ts`, `templates.ts`, `preferences.ts`, `in-app.ts`, `channels/`, `dispatcher.ts`, `index.ts`)
- **Required Environment Variables**: None for offline development. (Optional: `RESEND_API_KEY`, `EMAIL_FROM`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`).
- **How to enable & use**:
  ```typescript
  import {
    sharedNotificationDispatcher,
    sharedInAppStore,
    sharedPreferenceStore,
    type Recipient,
  } from '@/lib/notifications'

  const recipient: Recipient = {
    id: 'usr_123',
    email: 'user@example.com',
    phone: '+14155552671',
    name: 'Ada Lovelace',
  }

  // 1. Dispatch multi-channel notification using a template
  const result = await sharedNotificationDispatcher.send(
    recipient,
    {
      templateId: 'welcome_email',
      variables: { name: 'Ada', appUrl: 'https://hackathon.dev' },
      category: 'transactional',
    },
    {
      channels: ['email', 'in_app', 'realtime'],
      idempotencyKey: 'welcome_usr_123',
    }
  )
  console.log('Notification delivery results:', result.results)

  // 2. Query in-app user notifications inbox
  const unreadCount = sharedInAppStore.getUnreadCount('usr_123')
  const userNotifications = sharedInAppStore.listForUser('usr_123', { unreadOnly: true })

  // 3. Mark in-app notification as read
  if (userNotifications.length > 0) {
    sharedInAppStore.markAsRead(userNotifications[0].id, 'usr_123')
  }

  // 4. Update user preferences (e.g., disable marketing emails)
  sharedPreferenceStore.setUserPreferences({
    userId: 'usr_123',
    channels: { email: false, in_app: true, realtime: true },
    categories: { marketing: false },
  })
  ```
- **Security & Reliability Directives**:
  - All template interpolation auto-escapes HTML characters to prevent XSS attacks in email clients or in-app HTML views.
  - Critical `security` notifications (e.g. login from new device, password reset) strictly bypass marketing opt-outs and are always delivered.
  - Asynchronous background dispatching can be activated by passing `async: true` in `SendNotificationOptions`, queueing tasks through `sharedJobQueue`.

---

### 12. Analytics, Logging & Observability Toolkit
- **Status**: `READY`
- **Reference Repositories**:
  - [`pinojs/pino`](https://github.com/pinojs/pino) (MIT) — Fast JSON logging, child loggers, automated secret scrubbing.
  - [`open-telemetry/opentelemetry-js`](https://github.com/open-telemetry/opentelemetry-js) (Apache-2.0) — Distributed tracing, spans, W3C traceparent context propagation.
  - [`siimon/prom-client`](https://github.com/siimon/prom-client) (Apache-2.0) — Metric types (Counter, Gauge, Histogram), low-cardinality label enforcement.
  - [`getsentry/sentry-javascript`](https://github.com/getsentry/sentry-javascript) (MIT) — Sanitized error reporting, breadcrumb trails, environment tags.
- **Location**: [`src/lib/observability/`](file:///c:/Users/rspma/Downloads/Hackathon-starter/src/lib/observability/) (`types.ts`, `tracer.ts`, `metrics.ts`, `errors.ts`, `index.ts`) & [`src/lib/logging/logger.ts`](file:///c:/Users/rspma/Downloads/Hackathon-starter/src/lib/logging/logger.ts)
- **Required Environment Variables**: None for local development. (Optional: `LOG_LEVEL=info`, `SENTRY_DSN=`).
- **How to enable & use**:
  ```typescript
  import {
    logger,
    sharedTracer,
    sharedMetrics,
    sharedErrorReporter,
    calculateAiCost,
  } from '@/lib/observability'

  // 1. Contextual child logger with automated secret scrubbing
  const reqLogger = logger.child({ requestId: 'req_123', service: 'ai-agent' })
  reqLogger.info('Initiating LLM completion', { promptTokens: 420 })

  // 2. Distributed tracing across async operations
  const result = await sharedTracer.withSpan('ai_agent_task', 'agent', async (span) => {
    span.setTag('agentId', 'researcher')

    // Child span for tool execution
    const searchData = await sharedTracer.withSpan('tool_search', 'tool', async (toolSpan) => {
      toolSpan.setTag('query', 'Hackathon starter guide')
      return { count: 3 }
    }, { parent: span })

    return searchData
  })

  // 3. Application metrics with low-cardinality label validation
  sharedMetrics.counter('http_requests_total').inc({ method: 'POST', status: '200' })
  sharedMetrics.histogram('http_request_duration_ms').observe({ route: '/api/chat' }, 145)

  // 4. Grounded AI usage and cost tracking (strictly when pricing is configured)
  const cost = calculateAiCost('gpt-4o', 1000, 500)
  console.log('Estimated inference cost (USD):', cost) // $0.0075

  // 5. Sanitized error capture with breadcrumb trail
  sharedErrorReporter.addBreadcrumb({ category: 'network', message: 'Connecting to database' })
  try {
    throw new Error('Connection refused with secret sk-1234567890')
  } catch (err) {
    const errorId = await sharedErrorReporter.captureException(err, {
      tags: { service: 'auth' },
      extra: { attempt: 2 },
    })
    console.log('Captured sanitized error ID:', errorId)
  }
  ```
- **Privacy & Security Directives**:
  - `redactSensitiveData` automatically scrubs Bearer tokens, API keys, passwords, and authorization cookies.
  - `sanitizeLogMessage` strips carriage returns and line feeds to prevent log injection exploits.
  - Spans do not record private prompts, full user documents, or raw credentials by default.
  - Metric labels reject high-cardinality keys (`userId`, `url`, `query`, `prompt`) to avoid unbounded memory growth.

---

### 13. Realtime Collaboration Toolkit
- **Status**: `READY`
- **Reference Repositories**:
  - [`socketio/socket.io`](https://github.com/socketio/socket.io) (MIT) — Rooms, pub/sub, connection state recovery, typed message envelopes.
  - [`yjs/yjs`](https://github.com/yjs/yjs) (MIT) — Collaborative editing patterns, document state vectors, conflict-free synchronization.
  - [`liveblocks/liveblocks`](https://github.com/liveblocks/liveblocks) (Proprietary SDK / Hosted) — Ephemeral presence (cursors/status), versioned shared storage, broadcast channels, room authorization.
  - [`partykit/partykit`](https://github.com/partykit/partykit) (MIT / Apache-2.0) — Room-based server execution model, lifecycle events, zero-dependency edge coordination.
- **Location**:
  - Server & Client: [`src/lib/realtime/`](file:///c:/Users/rspma/Downloads/Hackathon-starter/src/lib/realtime/) (`collaboration-types.ts`, `collaboration-server.ts`, `collaboration-client.ts`, `websocket.ts`, `sse.ts`, `index.ts`)
  - React Hook: [`src/hooks/use-realtime-room.ts`](file:///c:/Users/rspma/Downloads/Hackathon-starter/src/hooks/use-realtime-room.ts)
- **Required Environment Variables**: None for local development. Zero external accounts, cloud subscriptions, or hosted infrastructure required.
- **How to enable & use**:
  ```typescript
  // --- 1. Server-Side Room Coordinator (Node, API Route, or Custom Server) ---
  import { RealtimeServer } from '@/lib/realtime'

  const server = new RealtimeServer({
    maxMessageSizeBytes: 64 * 1024, // 64KB max payload
    rateLimitPerSecond: 50,
    authenticate: async (token) => {
      // Validate session / JWT token
      if (token === 'admin_token') return { id: 'u_1', name: 'Alice', role: 'admin' }
      return null
    },
    canJoinRoom: (user, roomId) => {
      // Restrict access to private channels
      if (roomId.startsWith('private:') && !user) return false
      return true
    },
  })

  // Register an incoming socket (implements ISocketConnection)
  // await server.registerConnection(socket, { token: clientToken })

  // --- 2. Client-Side Realtime Collaboration Client ---
  import { RealtimeCollaborationClient } from '@/lib/realtime'

  const client = new RealtimeCollaborationClient({
    url: 'wss://api.example.com/realtime',
    authToken: 'my_session_token',
    autoConnect: true,
  })

  // Join a room with initial presence
  client.joinRoom('whiteboard-42', { cursor: { x: 100, y: 200 }, color: '#3b82f6' })

  // Mutate shared state key with Last-Write-Wins (LWW) conflict resolution
  client.setStateKey('whiteboard-42', 'canvasData', { strokeCount: 5 })

  // Broadcast a transient peer event (e.g. laser pointer, chat alert)
  client.broadcast('whiteboard-42', 'laser_pointer', { x: 150, y: 220 })

  // --- 3. React Frontend Hook Integration ---
  import { useRealtimeRoom } from '@/hooks'

  export function WhiteboardEditor({ roomId }: { roomId: string }) {
    const {
      status,
      isConnected,
      state,
      presence,
      myPresence,
      updatePresence,
      setStateKey,
      broadcast,
    } = useRealtimeRoom<{ canvasData: any }, { cursor: { x: number; y: number } }>({
      roomId,
      client,
      initialPresence: { cursor: { x: 0, y: 0 } },
    })

    return (
      <div>
        <p>Status: {status} ({isConnected ? 'Online' : 'Offline'})</p>
        <p>Active Peers: {Object.keys(presence).length}</p>
        <button onClick={() => setStateKey('canvasData', { cleared: true })}>
          Clear Canvas
        </button>
      </div>
    )
  }
  ```
- **Security & Reliability Directives**:
  - Connection authentication verifies credentials server-side; client-asserted user identities and permissions are never trusted.
  - Inbound messages strictly enforce payload size caps (default 64KB) and sliding-window rate limits to defend against resource exhaustion.
  - Message IDs are deduplicated through an in-memory TTL cache to prevent duplicate processing on network retries.
  - State conflicts are resolved via deterministic Last-Write-Wins (LWW) and sequence numbering. Optimistic concurrency checks (`expectedVersion`) reject stale edits with `VERSION_CONFLICT`.
  - Ephemeral presences automatically vacate rooms when sockets disconnect or leave.

---

### 14. Computer Vision & Video Processing Toolkit
- **Status**: `READY`
- **Reference Repositories**:
  - [`ultralytics/ultralytics`](https://github.com/ultralytics/ultralytics) (AGPL-3.0 / Enterprise) — State-of-the-art object detection, pose estimation, and classification. *Note: AGPL-3.0 model weights require open-sourcing derived network applications or securing commercial licenses.*
  - [`opencv/opencv`](https://github.com/opencv/opencv) (Apache-2.0) — Video decoding, frame sequencing, aspect ratio normalization, image processing algorithms.
  - [`google-ai-edge/mediapipe`](https://github.com/google-ai-edge/mediapipe) (Apache-2.0) — On-device real-time visual tracking, facial landmarks, and gesture detection.
  - [`huggingface/transformers.js`](https://github.com/huggingface/transformers.js) (Apache-2.0) — Browser-side ONNX model inference (YOLOS, Vision Transformer) without backend dependencies.
  - [`microsoft/onnxruntime`](https://github.com/microsoft/onnxruntime) (MIT) — High-performance cross-platform ML engine with optional WebGPU acceleration.
- **Location**:
  - Library: [`src/lib/vision/`](file:///c:/Users/rspma/Downloads/Hackathon-starter/src/lib/vision/) (`cv-types.ts`, `cv-provider.ts`, `video.ts`, `index.ts`)
  - Hook: [`src/hooks/use-camera.ts`](file:///c:/Users/rspma/Downloads/Hackathon-starter/src/hooks/use-camera.ts)
  - Component: [`src/components/vision/camera-preview.tsx`](file:///c:/Users/rspma/Downloads/Hackathon-starter/src/components/vision/camera-preview.tsx)
- **Required Environment Variables**: None for local development. (Optional: `VISION_SERVICE_URL` and `VISION_API_KEY` when connecting a remote YOLO or ONNX inference microservice).
- **How to enable & use**:
  ```typescript
  // --- 1. Object Detection & Scene Classification ---
  import {
    sharedComputerVisionProvider,
    MockComputerVisionProvider,
    HttpComputerVisionProvider,
  } from '@/lib/vision'

  // Detect objects with normalized coordinates [0.0, 1.0]
  const detections = await sharedComputerVisionProvider.detectObjects(
    { imageBase64: 'data:image/jpeg;base64,...' },
    { minConfidence: 0.5, maxDetections: 10 }
  )
  console.log('Detected objects:', detections)
  // [{ label: 'person', confidence: 0.94, box: { x: 0.15, y: 0.1, width: 0.35, height: 0.75 } }]

  // Classify scene or image context
  const classifications = await sharedComputerVisionProvider.classifyImage(
    { imageUrl: 'https://example.com/workspace.jpg' },
    { minConfidence: 0.4, topK: 3 }
  )
  console.log('Scene categories:', classifications)

  // --- 2. Automated Video Processing & Frame Analysis ---
  import { analyzeVideo } from '@/lib/vision'

  const videoReport = await analyzeVideo(
    {
      videoUrl: 'https://storage.example.com/session.mp4',
      mimeType: 'video/mp4',
      durationSeconds: 15,
    },
    sharedComputerVisionProvider,
    {
      task: 'both',
      fps: 1, // Sample 1 frame per second
      maxDurationSeconds: 60,
      detectionOptions: { minConfidence: 0.5 },
    }
  )
  console.log('Video summary:', videoReport.objectSummary)
  // { person: 15, laptop: 12, cup: 8 }

  // --- 3. Browser Camera Streaming & Preview Component ---
  import { CameraPreview } from '@/components/vision/camera-preview'

  export function LiveVisionWorkspace() {
    return (
      <div className="max-w-xl mx-auto p-4">
        <CameraPreview
          aspectRatio="video"
          onCapture={(frameBase64) => {
            console.log('Captured snapshot frame!')
          }}
          detections={detections}
        />
      </div>
    )
  }
  ```
- **Privacy & Safety Directives**:
  - Never transmit raw camera feeds or video frames externally without explicit user consent.
  - Never log raw image payloads, base64 data, or video frames in application logs or telemetry spans.
  - Video inputs enforce size boundaries (max 50MB) and duration limits (max 60s) to guard against server memory exhaustion.
  - Confidence values are strictly preserved and should be treated as probabilistic estimates rather than verified ground truth.

---

### 15. Export, Reporting & Document Generation Toolkit
- **Status**: `READY`
- **Reference Repositories**:
  - [`exceljs/exceljs`](https://github.com/exceljs/exceljs) (MIT) — Workbook & worksheet specifications, typed cell structures, column widths, and styles.
  - [`foliojs/pdfkit`](https://github.com/foliojs/pdfkit) (MIT) — Vector PDF document layouts, multi-page flows, and standard Type1 typography.
  - [`puppeteer/puppeteer`](https://github.com/puppeteer/puppeteer) (Apache-2.0) — Headless Chrome rendering. *(Note: Evaluated and deferred bundling ~200MB Chromium binaries in favor of pure TypeScript vector PDF generation).*
  - [`mholt/PapaParse`](https://github.com/mholt/PapaParse) (MIT) — RFC-4180 CSV serialization, delimiter escaping, and BOM handling.
  - [`SheetJS/sheetjs`](https://github.com/SheetJS/sheetjs) (Apache-2.0) — Cross-platform spreadsheet abstractions.
- **Location**:
  - Library: [`src/lib/export/`](file:///c:/Users/rspma/Downloads/Hackathon-starter/src/lib/export/) (`types.ts`, `csv.ts`, `json.ts`, `excel.ts`, `pdf.ts`, `generator.ts`, `index.ts`)
  - Hook: [`src/hooks/use-file-download.ts`](file:///c:/Users/rspma/Downloads/Hackathon-starter/src/hooks/use-file-download.ts)
- **Required Environment Variables**: None for local development. Zero external accounts, binaries, or hosted infrastructure required.
- **How to enable & use**:
  ```typescript
  // --- 1. Tabular Data Export (CSV, Excel, JSON, PDF) ---
  import { exportData, exportAndStore } from '@/lib/export'
  import { sharedLocalStorage } from '@/lib/storage'

  const users = [
    { id: 1, name: 'Alice Smith', email: 'alice@example.com', score: 98.5 },
    { id: 2, name: 'Bob Jones', email: 'bob@example.com', score: 84.0 },
  ]

  // Export as RFC-4180 CSV with formula-injection defense
  const csvExport = exportData(users, 'csv', {
    filename: 'user_scores',
    columns: [
      { key: 'name', header: 'Full Name' },
      { key: 'score', header: 'Score' },
    ],
  })

  // Export as native Microsoft Excel XML Workbook (.xls)
  const excelExport = exportData(users, 'excel', {
    filename: 'user_scores',
    sheetName: 'Leaderboard',
  })

  // Export and save directly to file storage
  const { storageResult } = await exportAndStore(users, 'csv', sharedLocalStorage, {
    filename: 'archived_scores',
  })
  console.log('Archived file path:', storageResult.file?.path)

  // --- 2. Multi-Section Document & PDF Report Generation ---
  import { generateReport } from '@/lib/export'

  const pdfReport = generateReport({
    title: 'Monthly Performance Review',
    subtitle: 'System metrics and team throughput',
    author: 'Platform Audit',
    headerText: 'Confidential Internal Report',
    footerText: 'Department of Engineering',
    includePageNumbers: true,
    sections: [
      { type: 'heading', level: 1, content: 'Overview' },
      { type: 'paragraph', content: 'Operational summary of microservices and agent execution.' },
      {
        type: 'key_value',
        data: { 'Total Requests': '1.2M', 'Success Rate': '99.94%', 'P99 Latency': '85ms' },
      },
      {
        type: 'table',
        data: users,
        columns: [
          { key: 'name', header: 'User' },
          { key: 'score', header: 'Performance Score' },
        ],
      },
    ],
  }, 'pdf', { filename: 'performance_review' })

  // --- 3. Frontend Client-Side Download Hook ---
  import { useFileDownload } from '@/hooks'

  export function ExportButton() {
    const { download, isDownloading, error } = useFileDownload()

    const handleDownload = () => {
      download({
        data: csvExport.data,
        filename: csvExport.filename,
        contentType: csvExport.contentType,
      })
    }

    return (
      <button onClick={handleDownload} disabled={isDownloading}>
        {isDownloading ? 'Generating...' : 'Download CSV'}
      </button>
    )
  }
  ```
- **Security & Reliability Directives**:
  - Automatically defends against formula injection attacks (CWE-1236) by neutralizing strings beginning with `=`, `+`, `-`, `@`, `\t`, or `\r`.
  - Filenames are sanitized against path traversal (`../`) and illegal control characters.
  - Large-input boundaries strictly enforce maximum row limits (default 50,000) to prevent memory exhaustion.
  - Object URLs created during client-side downloads are automatically revoked via `URL.revokeObjectURL` to eliminate memory leaks.

---

## 16. Testing & Quality Automation Toolkit (`src/lib/testing/`)

### Overview
The testing toolkit provides deterministic fixtures, route-level mock dispatchers, API response assertions, adversarial prompt-injection vectors, and AI output grounding evaluators for fast hackathon development without relying on paid third-party APIs.

### Quick Verification Commands
```bash
# Run standard quality gates (env check, ESLint, TypeScript compiler, Vitest, Next.js build)
npm run verify

# Include Playwright browser end-to-end smoke tests
npm run verify:all

# Fast iteration mode (skips production bundle compilation)
node scripts/verify.mjs --quick
```

### Module Import Paths
```typescript
import {
  // Deterministic Utilities
  createDeterministicClock,
  createDeterministicRandom,
  createTestFactory,
  simulateTransientFailure,

  // HTTP & API Testing Helpers
  createMockFetch,
  createMockRequest,
  assertApiResponse,
  generateMockWebhookSignature,
  assertIdempotentExecution,

  // AI-Specific Quality Evaluation
  validateStructuredOutput,
  validateToolCall,
  evaluateCitationGrounding,
  evaluateAgentLoopTermination,
  PROMPT_INJECTION_VECTORS,

  // Domain Entity Fixtures
  createTestUser,
  createTestSession,
  createTestWebhookPayload,
  createTestFileRecord,
} from '@/lib/testing'
```

### Integration Examples

#### 1. Mock Fetch Interception & Transient Retries
```typescript
import { createMockFetch, simulateTransientFailure } from '@/lib/testing'

// Mock REST endpoints without network overhead
const mockFetch = createMockFetch([
  {
    url: '/api/v1/projects',
    method: 'GET',
    status: 200,
    response: [{ id: 'p1', name: 'Hackathon MVP' }],
  },
])

// Simulate transient failures to verify circuit-breaker / retry resilience
const fetchWithRetry = simulateTransientFailure(2, { status: 'healthy' })
```

#### 2. AI Structured Output Validation (JSON & Markdown)
```typescript
import { z } from 'zod'
import { validateStructuredOutput } from '@/lib/testing'

const TaskPlanSchema = z.object({
  title: z.string(),
  steps: z.array(z.string()),
})

// Handles raw JSON or Markdown fences: ```json\n{...}\n```
const result = validateStructuredOutput(llmResponseString, TaskPlanSchema)
if (result.success) {
  console.log('Validated plan:', result.data.title)
}
```

#### 3. Source Grounding & Hallucination Scoring
```typescript
import { evaluateCitationGrounding } from '@/lib/testing'

const sourceKnowledge = [
  'Hackathon Starter Foundation includes Next.js 16, Supabase auth, and offline fixtures.',
]

const answer = 'The starter provides Next.js 16 and Supabase auth [1].'
const evalResult = evaluateCitationGrounding(answer, sourceKnowledge)

console.log('Is grounded:', evalResult.grounded) // true
console.log('Grounding score:', evalResult.groundingScore) // >= 0.70
```

#### 4. Webhook HMAC-SHA256 Signatures & Idempotency
```typescript
import { generateMockWebhookSignature, assertIdempotentExecution } from '@/lib/testing'

const payload = { event: 'payment.completed', id: 'evt_123' }
const sig = generateMockWebhookSignature(payload, 'whsec_secret')

// Verify idempotent handler execution over multiple calls
await assertIdempotentExecution(async () => {
  return handleWebhookEvent(payload)
}, 3)
```

### Quality & Reliability Guardrails
- **Exit Codes**: Failures in `scripts/verify.mjs` immediately exit with code `1`.
- **Zero Real API Reliance**: Fast offline fixtures prevent unintended charges during automated test execution.
- **Redaction in Test Output**: All credentials and sensitive API tokens remain masked across diagnostic commands.

---

## 17. Feature Flags & Runtime Configuration Toolkit (`src/lib/config/`)

### Overview
A modular, typed runtime configuration and feature flag engine that lets hackathon teams enable, disable, and gradually roll out features without repeatedly modifying application code or redeploying.

### Module Import Paths
```typescript
import {
  // Runtime Environment & Configuration
  getEnvironment,
  validateServerConfig,
  getClientConfig,
  assertRequiredEnv,
  ConfigurationError,

  // Feature Flag Engine & Helpers
  featureFlagManager,
  isFeatureEnabled,
  calculateRolloutBucket,
  InMemoryFeatureFlagProvider,
  EnvFeatureFlagProvider,
  type FeatureFlagDefinition,
  type EvaluationContext,
} from '@/lib/config'

// Frontend React Hook
import { useFeatureFlag } from '@/hooks'
```

### Precedence Hierarchy
When evaluating flag state, the engine enforces 7 strict precedence tiers:

| Tier | Rule | Behavior |
| :--- | :--- | :--- |
| **1** | **Emergency Kill-Switch** | If `emergencyKillSwitch: true`, immediately disables flag (`false`). |
| **2** | **Manual Override** | In-memory runtime override set via `setOverride(key, val)` takes priority. |
| **3** | **User Targeting** | If user ID/targetingKey exists in `allowedUsers`, enables flag (`true`). |
| **4** | **Role Targeting** | If `context.userRole` matches any role in `requiredRoles`, enables flag (`true`). |
| **5** | **Environment Filter** | If current environment is not listed in `enabledEnvironments`, disables flag (`false`). |
| **6** | **Percentage Rollout** | Deterministic FNV-1a hash bucket (`0..99`) compared against `percentageRollout`. |
| **7** | **Static Default** | Falls back to `defaultValue`. |

### Integration Examples

#### 1. Defining and Registering a Feature Flag
```typescript
import { featureFlagManager } from '@/lib/config'

featureFlagManager.registerFlag({
  key: 'experimental-agent-loop',
  description: 'Gradual rollout of multi-step agent reasoning',
  defaultValue: false,
  enabledEnvironments: ['development', 'test', 'production'],
  percentageRollout: 25, // 25% of users receive feature deterministically
  allowedUsers: ['user_vip_beta'],
  requiredRoles: ['admin', 'maintainer'],
  emergencyKillSwitch: false,
})
```

#### 2. Server-Side Evaluation & Guarding
```typescript
import { isFeatureEnabled } from '@/lib/config'

export async function processTaskAction(userId: string, userRole: string) {
  const isEnabled = isFeatureEnabled('experimental-agent-loop', {
    userId,
    userRole,
  })

  if (!isEnabled) {
    return { standardMode: true }
  }

  return { experimentalAgent: true }
}
```

#### 3. Client-Side Reactive Component Hook
```tsx
'use client'

import { useFeatureFlag } from '@/hooks'

export function BetaFeaturePanel() {
  const showBeta = useFeatureFlag('experimental-agent-loop', { defaultValue: false })

  if (!showBeta) return null

  return (
    <div className="p-4 border rounded bg-indigo-50 dark:bg-indigo-950">
      <h3>Experimental Agent Reasoning</h3>
      <p>This feature is active for your cohort.</p>
    </div>
  )
}
```

#### 4. Safe Runtime Configuration & Secret Isolation
```typescript
import { validateServerConfig, getClientConfig } from '@/lib/config'

// Server-side (includes sensitive keys)
const serverConfig = validateServerConfig(process.env)
console.log(serverConfig.supabase.serviceRoleKey) // Available on server only

// Client-safe configuration (secrets stripped)
const clientConfig = getClientConfig(serverConfig)
console.log(clientConfig.supabaseAnonKey) // Safe for client
```

### Security & Reliability Guardrails
- **Client Flags are NOT Authorization**: Frontend feature flags control UI rendering only. Server routes, database operations, and server actions must verify authentication and authorization independently.
- **Zero Secret Exposure**: Server credentials (`SUPABASE_SERVICE_ROLE_KEY`, database strings) are completely excluded from `ClientConfig`.
- **Deterministic Cohorts**: Percentage rollouts use FNV-1a hashing on `${flagKey}:${targetingKey}` ensuring identical users remain in the exact same cohort across page navigations and restarts.

---

## 18. API Client & Resilience Toolkit (`src/lib/api/`)

### Overview
A production-grade, highly resilient HTTP client and fault-tolerance toolkit providing configurable retries with backoff and jitter, circuit breaker state machines, bulkhead concurrency limiters, token-bucket rate limiting, decoupled provider adapters, and automatic credential redaction.

### Module Import Paths
```typescript
import {
  // Core HTTP Client
  safeFetch,
  createApiClient,
  apiClient,
  type SafeFetchOptions,
  type SafeFetchResult,

  // Resilience Policies
  CircuitBreakerPolicy,
  CircuitBreakerOpenError,
  ConcurrencyLimiter,
  ConcurrencyLimitError,
  RateLimiterPolicy,
  RateLimitExceededError,
  PolicyPipeline,

  // Normalized Error & Redaction Utilities
  ApiClientError,
  redactSensitiveHeaders,

  // Decoupled Provider Integration
  BaseApiAdapter,
  ExampleExternalServiceAdapter,
  type ApiClientHooks,
} from '@/lib/api'
```

### Integration Examples

#### 1. Making Resilient Requests with `safeFetch`
```typescript
import { safeFetch } from '@/lib/api'
import { z } from 'zod'

const UserResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
})

const result = await safeFetch('https://api.external.dev/users/42', {
  method: 'GET',
  timeoutMs: 5000,
  retries: 3,
  retryDelayMs: 200,
  schema: UserResponseSchema, // Optional Zod validation
})

if (result.ok) {
  console.log('User data:', result.data.name)
} else {
  console.error('Request failed:', result.error, result.errorCode)
}
```

#### 2. Protecting Downstream Services with Circuit Breakers
```typescript
import { CircuitBreakerPolicy } from '@/lib/api'

// Trip after 3 consecutive failures; probe recovery after 10s
const breaker = new CircuitBreakerPolicy({
  failureThreshold: 3,
  resetTimeoutMs: 10000,
})

breaker.onStateChange((from, to) => {
  console.log(`Circuit state shifted: ${from} -> ${to}`)
})

// Execute operations through the breaker
const data = await breaker.execute(async () => {
  const res = await fetch('https://flaky-external-service.dev/api')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
})
```

#### 3. Regulating Load with Concurrency & Rate Limiters
```typescript
import { ConcurrencyLimiter, RateLimiterPolicy } from '@/lib/api'

// Bulkhead: Max 5 simultaneous connections, queue up to 20
const bulkhead = new ConcurrencyLimiter({ maxConcurrent: 5, maxQueue: 20 })

// Token Bucket: Max 10 requests per second
const rateLimiter = new RateLimiterPolicy({ tokensPerInterval: 10, intervalMs: 1000 })

// Execute bounded work
await bulkhead.execute(async () => {
  return rateLimiter.execute(async () => {
    return safeFetch('https://api.provider.dev/action')
  })
})
```

#### 4. Decoupled Provider Adapters
```typescript
import { BaseApiAdapter } from '@/lib/api'

export class CustomWeatherAdapter extends BaseApiAdapter {
  constructor(apiKey?: string) {
    super({
      baseUrl: 'https://api.weather-service.dev/v1',
      apiKey,
      timeoutMs: 5000,
      retries: 2,
      useCircuitBreaker: true,
    })
  }

  protected getProviderHeaders(): Record<string, string> {
    return {
      'x-api-key': this.apiKey || '',
      'accept': 'application/json',
    }
  }

  protected normalizeError(status: number, rawError?: string): string {
    if (status === 401) return 'Weather service key invalid or expired.'
    if (status === 429) return 'Weather rate limit reached.'
    return rawError || 'Weather lookup failed.'
  }

  public async getForecast(city: string) {
    return this.request(`/forecast?city=${encodeURIComponent(city)}`)
  }
}
```

### Security & Reliability Guardrails
- **Safe Idempotency**: Safe methods (`GET`, `HEAD`, `OPTIONS`, `PUT`, `DELETE`) are safely retried on 5xx/429. Mutating operations (`POST`, `PATCH`) are **NEVER** automatically retried unless explicitly designated with `idempotent: true`.
- **Credential Redaction**: `Authorization`, `X-Api-Key`, `Cookie`, and `Proxy-Authorization` headers are automatically replaced with `[REDACTED]` in logs and telemetry payloads.
- **Fail-Safe Fallbacks**: Provider adapters gracefully report offline status when optional API keys are unconfigured without crashing the server.

---

## 19. Data Visualization & Dashboard Toolkit

### Overview & Philosophy
The **Data Visualization & Dashboard Toolkit** provides modular, zero-dependency SVG visualization components and responsive dashboard layouts for hackathons involving analytics, monitoring, telemetry, financial statistics, or real-time data feeds.

### Reference Repositories Studied
1. **Recharts** (`recharts/recharts` - MIT): Studied declarative SVG composition, Cartesian grids, axis tick generation, and responsive coordinate scaling.
2. **Apache ECharts** (`apache/echarts` - Apache 2.0): Studied dense data presentation, tooltip positioning, and multi-category visual contrast.
3. **Chart.js** (`chartjs/Chart.js` - MIT): Studied aspect-ratio management, legend interaction, and responsive canvas geometry.
4. **TanStack Table** (`TanStack/table` - MIT): Studied headless sorting, filtering, and pagination contracts.
5. **Tremor** (`tremorlabs/tremor` - Apache 2.0): Studied modern Tailwind-native dashboard building blocks, KPI metric cards, and badge accents.

### Why Pure React + SVG (Zero Heavy Dependencies)
- **Zero Bundle Bloat**: Eliminates megabytes of external JavaScript bundles.
- **100% SSR & React 19 Compatible**: Native SVG elements (`<svg viewBox="...">`) render seamlessly on both server and client without hydration errors or canvas mock requirements.
- **Accessible & Screen-Reader Ready**: Every chart renders semantic `<svg role="img" aria-label="...">`, `<title>`, `<desc>`, and keyboard-accessible points (`tabIndex={0}`).
- **Theme Native**: Integrates directly with Tailwind CSS v4 design tokens and dark mode classes (`dark:border-slate-800`, `text-slate-900`, `dark:text-slate-100`).

### Component Reference

| Component | Location | Purpose |
| :--- | :--- | :--- |
| `MetricCard` | `src/components/visualization/metric-card.tsx` | KPI cards with delta percentages, previous period comparison, icons, and sparklines |
| `LineChart` | `src/components/visualization/line-chart.tsx` | Pure SVG line charts for continuous trends over time with tooltips |
| `BarChart` | `src/components/visualization/bar-chart.tsx` | Comparative vertical bar charts with rounded caps and automatic slot widths |
| `AreaChart` | `src/components/visualization/area-chart.tsx` | Cumulative volume charts with linear gradient opacity fills |
| `DonutChart` | `src/components/visualization/donut-chart.tsx` | Proportional pie/donut charts with arc geometry, center metric, and color legend |
| `PaginatedDataTable` | `src/components/visualization/paginated-data-table.tsx` | Filterable, sortable, and paginated data table building on existing primitives |
| `DashboardHeader` | `src/components/visualization/dashboard-layout.tsx` | Page title, description, timestamp indicator, and refresh action button |
| `DashboardGrid` | `src/components/visualization/dashboard-layout.tsx` | Responsive 1-to-4 column grid layout |
| `DashboardSection` | `src/components/visualization/dashboard-layout.tsx` | Section container with title, description, and action slots |
| `DateRangeFilter` | `src/components/visualization/dashboard-layout.tsx` | Keyboard-accessible preset pills (`7D`, `30D`, `90D`, `1Y`, `ALL`) |
| `DemoDashboard` | `src/components/visualization/demo-dashboard.tsx` | Complete representative dashboard page with deterministic fixture data |

### Example Usage: Building an Analytics View

```tsx
'use client'

import React from 'react'
import {
  MetricCard,
  LineChart,
  BarChart,
  DonutChart,
  DashboardHeader,
  DashboardGrid,
  DateRangeFilter,
} from '@/components/visualization'
import { formatCurrency, formatNumber } from '@/lib/visualization/formatters'

export function AnalyticsWorkspace() {
  const [range, setRange] = React.useState<'7d' | '30d' | '90d' | '1y' | 'all'>('30d')

  const kpis = [
    { title: 'Gross Revenue', value: formatCurrency(124850), change: 15.2, sparkline: [95, 102, 115, 124.8] },
    { title: 'Active Accounts', value: formatNumber(14200), change: 10.1, sparkline: [12, 13, 13.5, 14.2] },
  ]

  const trendData = [
    { label: 'W1', value: 24000 },
    { label: 'W2', value: 31000 },
    { label: 'W3', value: 45000 },
    { label: 'W4', value: 52000 },
  ]

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Live Business Telemetry"
        description="Key performance indicators and workload volume"
        actions={<DateRangeFilter activePreset={range} onPresetChange={setRange} />}
      />

      <DashboardGrid columns={2}>
        {kpis.map((kpi) => (
          <MetricCard
            key={kpi.title}
            title={kpi.title}
            value={kpi.value}
            change={kpi.change}
            sparklineData={kpi.sparkline}
          />
        ))}
      </DashboardGrid>

      <DashboardGrid columns={2}>
        <LineChart
          title="Revenue Growth"
          data={trendData}
          formatValue={(v) => formatCurrency(v, { notation: 'compact' })}
          curve="smooth"
        />
        <BarChart
          title="Weekly Inflow"
          data={trendData}
          formatValue={(v) => formatCurrency(v, { notation: 'compact' })}
        />
      </DashboardGrid>
    </div>
  )
}
```

---

## 20. Internationalization, Localization & Accessibility Toolkit

### Overview & Philosophy
The **Internationalization, Localization & Accessibility Toolkit** provides modular capabilities for building multilingual, culturally-aware, and accessible applications. It ensures hackathon projects can support global audiences and users with disabilities without requiring major architectural refactoring.

### Reference Repositories Studied
1. **i18next & react-i18next** (`i18next/i18next` - MIT): Studied dictionary structure, nested key traversal, fallback chains, variable interpolation (`{{param}}`, `{param}`), exact count and pluralization rules, and reactive React context hooks.
2. **FormatJS / React Intl** (`formatjs/formatjs` - BSD-3-Clause): Studied native ECMAScript standard Internationalization API (`Intl.DateTimeFormat`, `Intl.NumberFormat`, `Intl.PluralRules`, `Intl.RelativeTimeFormat`), timezone configuration, and locale-specific currency display.
3. **Lingui** (`lingui/js-lingui` - MIT): Studied message extraction patterns and lightweight runtime performance.
4. **axe-core** (`dequelabs/axe-core` - MPL-2.0): Studied automated WCAG 2.1 AA evaluation rules, DOM violation scanning, and node failure summaries.

### Architecture & Components

| Module | Location | Purpose |
| :--- | :--- | :--- |
| `Translator` | `src/lib/i18n/translator.ts` | Translation lookup, interpolation, and pluralization engine |
| `formatLocaleDate` | `src/lib/i18n/formatters.ts` | Locale and timezone sensitive date/time formatting |
| `formatLocaleCurrency` | `src/lib/i18n/formatters.ts` | Dynamic currency formatting with locale symbol placement |
| `formatLocaleNumber` | `src/lib/i18n/formatters.ts` | Locale digit grouping and compact notation formatting |
| `formatRelativeTime` | `src/lib/i18n/formatters.ts` | Relative time formatting via `Intl.RelativeTimeFormat` |
| `I18nProvider` | `src/lib/i18n/context.tsx` | Reactive React context syncing `lang`, `dir`, and `localStorage` |
| `LiveAnnouncer` | `src/lib/a11y/announcer.tsx` | Visually hidden `aria-live` regions for screen-reader alerts |
| `usePrefersReducedMotion` | `src/lib/a11y/reduced-motion.ts` | Reactive system media query subscription via `useSyncExternalStore` |
| `trapFocus` | `src/lib/a11y/focus.ts` | Focus trap for modals and dialogs respecting `Tab` and `Shift+Tab` |
| `runA11yAudit` | `src/lib/a11y/audit.ts` | Automated accessibility test runner wrapping `axe-core` |
| `LanguageSwitcher` | `src/components/i18n/language-switcher.tsx` | Accessible dropdown and pill language selector components |
| `LocaleDemo` | `src/components/i18n/locale-demo.tsx` | Showcase component for translations, RTL, formatting, and a11y |

### Usage Guide

#### 1. Translating Text & Pluralization
```tsx
'use client'

import { useI18n } from '@/lib/i18n/context'

export function MyComponent() {
  const { t, locale, setLocale, direction } = useI18n()

  return (
    <div dir={direction}>
      {/* Interpolation */}
      <h1>{t('common.welcome', { name: 'Alex' })}</h1>

      {/* Pluralization based on count */}
      <p>{t('items', { count: 3 })}</p>

      {/* Language switcher */}
      <button onClick={() => setLocale('es')}>Español</button>
      <button onClick={() => setLocale('ar')}>العربية (RTL)</button>
    </div>
  )
}
```

#### 2. Screen-Reader Live Announcements
```tsx
'use client'

import { useAnnounce } from '@/lib/a11y/announcer'

export function ActionButton() {
  const { announce } = useAnnounce()

  const handleSave = async () => {
    // perform mutation...
    announce('Changes saved successfully', 'polite')
  }

  return <button onClick={handleSave}>Save</button>
}
```

#### 3. Automated & Manual Accessibility Testing
Automated scans with `runA11yAudit()` inspect rendered DOM trees against WCAG 2.1 AA criteria (color contrast, missing labels, button names, ARIA roles):
```typescript
import { runA11yAudit } from '@/lib/a11y/audit'

const audit = await runA11yAudit(document.body)
if (!audit.passes) {
  console.warn('Violations:', audit.violations)
}
```
> [!IMPORTANT]
> **Accessibility Reminder**: Automated audits catch approximately 30-50% of accessibility issues. Manual testing with keyboard navigation (`Tab`, `Shift+Tab`, `Enter`, `Escape`) and screen readers (VoiceOver, NVDA) is required for comprehensive compliance.

---

## 21. Progressive Web App (PWA) & Offline Support Toolkit

### Overview & Philosophy
The **PWA & Offline Support Toolkit** provides optional Progressive Web App and offline synchronization capabilities for future hackathon projects. The architecture adheres to three core tenets:
1. **Strictly Optional**: PWA functionality is disabled by default (`NEXT_PUBLIC_PWA_ENABLED=false`) to ensure the starter template remains lightweight and unopinionated. When disabled, service workers are proactively unregistered and caches cleared.
2. **Security-First Cache Isolation**: Dynamic API requests (`/api/*`), authentication cookies and routes (`/auth/*`), Supabase token endpoints (`*.supabase.co`), and administrative panels are strictly `NetworkOnly` and completely excluded from offline caches.
3. **Resilient Synchronization**: Offline user actions are stored in client-side IndexedDB with auto-generated idempotency keys (`Idempotency-Key` header) and automatically flushed when network connectivity is restored.

### Reference Repositories Studied
1. **vite-plugin-pwa** (`vite-pwa/vite-plugin-pwa` - MIT): Studied zero-config Web App Manifest generation, service worker lifecycle hooks, auto-update checks, and environment toggle controls.
2. **Workbox** (`GoogleChrome/workbox` - MIT): Studied industry standard caching strategies (`CacheFirst`, `NetworkFirst`, `NetworkOnly`), background synchronization, precaching assets, and offline fallback routes.
3. **Serwist** (`serwist/serwist` - MIT): Studied Next.js App Router and Turbopack service worker integration conventions.
4. **idb** (`jakearchibald/idb` - ISC): Studied lightweight Promise-based IndexedDB client storage wrappers and structured transaction handling.

### Architecture & Components

| Module | Location | Purpose |
| :--- | :--- | :--- |
| `PwaConfig` & defaults | `src/lib/pwa/config.ts` | PWA settings, cache name, excluded API prefixes, and feature toggles |
| `OfflineStorage` | `src/lib/pwa/indexed-db.ts` | Promise-based IndexedDB key-value store with SSR in-memory fallback |
| `OfflineQueueManager` | `src/lib/pwa/offline-queue.ts` | Action queue with idempotency keys, retry tracking, and auto-sync |
| `ServiceWorker` lifecycle | `src/lib/pwa/service-worker.ts` | SW registration, proactive unregistration when disabled, update check |
| Service Worker Script | `public/sw.js` | Workbox-style precaching, NetworkFirst navigation, CacheFirst static |
| Web App Manifest | `src/app/manifest.ts` | Next.js 16 native App Router Web App Manifest (`/manifest.webmanifest`) |
| Offline Fallback Page | `public/offline.html` | Dependency-free HTML fallback page when offline navigation fails |
| `useNetworkStatus` | `src/hooks/use-network-status.ts` | Subscribes to browser `online`/`offline` events and records timestamps |
| `usePwaInstall` | `src/hooks/use-pwa-install.ts` | Captures `beforeinstallprompt` event and triggers install modal |
| `useOfflineQueue` | `src/hooks/use-offline-queue.ts` | React hook subscribing to queued mutations and sync actions |
| `<OfflineBanner />` | `src/components/pwa/offline-banner.tsx` | Status banner displaying offline state and pending sync count |
| `<PwaInstaller />` | `src/components/pwa/pwa-installer.tsx` | Install prompt card with dismiss and install action triggers |
| `<PwaDemo />` | `src/components/pwa/pwa-demo.tsx` | Complete interactive demo for storage, queueing, and SW status |
| Dashboard Route | `src/app/dashboard/pwa/page.tsx` | Protected workspace demo page integrated into `DashboardShell` |

### Environment Configuration & Activation

To activate PWA features in a project, configure the following in `.env.local`:
```bash
# Enable PWA service worker and manifest caching
NEXT_PUBLIC_PWA_ENABLED=true

# Optional customization
NEXT_PUBLIC_APP_NAME="My Hackathon App"
```

### Usage Guide

#### 1. Enqueueing Offline Actions with Idempotency
```typescript
import { useOfflineQueue } from '@/hooks/use-offline-queue'

export function CreateNoteForm() {
  const { enqueue, isPending } = useOfflineQueue()

  const handleSubmit = async (noteData: { title: string; content: string }) => {
    await enqueue({
      url: '/api/notes',
      method: 'POST',
      body: noteData,
      // Auto-generates idempotencyKey or accept custom:
      // idempotencyKey: 'custom-uuid',
    })
  }

  return <button onClick={() => handleSubmit({ title: 'Idea', content: 'Hackathon' })}>Save Note</button>
}
```

#### 2. Structured Client-Side Offline Storage (IndexedDB)
```typescript
import { offlineStorage } from '@/lib/pwa/indexed-db'

// Save draft
await offlineStorage.set('draft_project_1', { title: 'Project A', budget: 1000 })

// Retrieve draft
const draft = await offlineStorage.get('draft_project_1')

// Delete draft
await offlineStorage.delete('draft_project_1')
```

#### 3. Network Status & Install Prompts
```tsx
'use client'

import { useNetworkStatus } from '@/hooks/use-network-status'
import { OfflineBanner } from '@/components/pwa/offline-banner'
import { PwaInstaller } from '@/components/pwa/pwa-installer'

export function AppHeader() {
  const { isOnline } = useNetworkStatus()

  return (
    <div>
      <OfflineBanner />
      <PwaInstaller />
      <span>Status: {isOnline ? 'Online' : 'Offline'}</span>
    </div>
  )
}
```

### Browser & HTTPS Requirements
- **HTTPS Required in Production**: Progressive Web Apps and Service Workers strictly require HTTPS in production environments. Modern browsers will refuse to register service workers over insecure HTTP (except for `localhost` and `127.0.0.1` during local development).
- **Sensitive Data Exclusion**: Service workers never cache `/api/`, `/auth/`, or Supabase authentication tokens. All sensitive operations require network connectivity and verified server-side authentication.

---

## 22. Forms & Validation Toolkit

### Overview & Philosophy
The **Forms & Validation Toolkit** provides type-safe, production-ready form primitives designed for rapid integration in hackathon projects. Built with pure React 19 hooks and Zod 4, it eliminates third-party peer-dependency conflicts while supporting multi-step wizards, dynamic field arrays, server error mapping, and secure file uploads.

### Reference Repositories Studied
1. **React Hook Form** (`react-hook-form/react-hook-form` - MIT): Studied uncontrolled/controlled state registration, dirty/touched tracking, nested path resolution, dynamic field array manipulations, and schema validation resolvers.
2. **Zod** (`colinhacks/zod` - MIT): Studied schema composition, async validation pipelines, and issue path mapping.
3. **TanStack Form** (`TanStack/form` - MIT): Studied headless architecture, submission locking, and granular field validation modes (`onSubmit`, `onChange`, `onBlur`).
4. **FormKit** (`formkit/formkit` - MIT): Studied accessible label-input associations, required asterisks, and live error region announcements (`aria-describedby`, `aria-invalid`, `role="alert"`).
5. **Uppy** (`transloadit/uppy` - MIT): Studied secure client-side file inspection, extension/MIME checks, and binary magic-bytes signature verification.

### Architecture & Components

| Module | Location | Purpose |
| :--- | :--- | :--- |
| `useForm` | `src/lib/forms/use-form.ts` | Form state, schema validation, submission locking, and draft persistence |
| `useFieldArray` | `src/lib/forms/use-field-array.ts` | Dynamic array management (`append`, `prepend`, `remove`, `swap`, `move`) |
| `useMultiStepForm` | `src/lib/forms/use-multi-step-form.ts` | Multi-step navigation controller with per-step validation gating |
| `validateWithZod` | `src/lib/forms/resolver.ts` | Async Zod schema validator mapping issues to dotted field paths |
| `mapServerErrors` | `src/lib/forms/resolver.ts` | Normalizes backend HTTP 422 or error objects onto form field errors |
| `validateFileSafety` | `src/lib/forms/file-validation.ts` | Size, extension, MIME, and binary magic-bytes format validator |
| `<MultiStepFormStepper />` | `src/components/forms/multi-step-form-stepper.tsx` | Accessible progress bar and step indicators with `aria-current="step"` |
| `<FormFieldWrapper />` | `src/components/forms/form-field-wrapper.tsx` | Accessible input wrapper with labels, descriptions, and error alerts |
| `<FormDemo />` | `src/components/forms/form-demo.tsx` | Interactive 3-step project onboarding demo |
| Dashboard Route | `src/app/dashboard/forms/page.tsx` | Route integrated into `DashboardShell` under "Forms & Validation" |

### Usage Guide

#### 1. Basic Form with Zod Validation
```tsx
'use client'

import { z } from 'zod'
import { useForm } from '@/lib/forms'
import { FormFieldWrapper } from '@/components/forms/form-field-wrapper'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const contactSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
})

type ContactValues = z.infer<typeof contactSchema>

export function ContactForm() {
  const form = useForm<ContactValues>({
    defaultValues: { name: '', email: '' },
    schema: contactSchema,
    mode: 'onBlur',
  })

  const onSubmit = async (values: ContactValues) => {
    await fetch('/api/contact', {
      method: 'POST',
      body: JSON.stringify(values),
    })
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <FormFieldWrapper id="name" label="Full Name" required error={form.errors.name}>
        <Input id="name" {...form.register('name')} />
      </FormFieldWrapper>

      <FormFieldWrapper id="email" label="Email" required error={form.errors.email}>
        <Input id="email" type="email" {...form.register('email')} />
      </FormFieldWrapper>

      <Button type="submit" disabled={form.isSubmitting}>
        {form.isSubmitting ? 'Sending...' : 'Submit'}
      </Button>
    </form>
  )
}
```

#### 2. Dynamic Field Arrays
```tsx
import { useFieldArray } from '@/lib/forms'

export function TeamRoster() {
  const { fields, append, remove } = useFieldArray<{ name: string; role: string }>({
    initialValues: [{ name: 'Alex', role: 'Engineer' }],
  })

  return (
    <div>
      {fields.map((field, idx) => (
        <div key={field.id} className="flex gap-2">
          <span>{field.value.name}</span>
          <button type="button" onClick={() => remove(idx)}>Remove</button>
        </div>
      ))}
      <button type="button" onClick={() => append({ name: '', role: '' })}>+ Add</button>
    </div>
  )
}
```

#### 3. Secure File Inspection (Magic-Bytes Detection)
```typescript
import { validateFileSafety } from '@/lib/forms/file-validation'

const result = await validateFileSafety(selectedFile, {
  maxSizeBytes: 5 * 1024 * 1024, // 5MB
  allowedExtensions: ['.pdf', '.png', '.jpg'],
  allowedMimeTypes: ['application/pdf', 'image/png', 'image/jpeg'],
  verifyMagicBytes: true, // inspects binary header to defeat extension spoofing
})

if (!result.isValid) {
  console.error('File rejected:', result.error)
}
```

### Security & Resilience Directives
- **Double-Submission Prevention**: `handleSubmit` automatically locks execution with an `isSubmitting` flag to block concurrent or duplicate clicks.
- **Draft Scrubbing**: `persistDraft` automatically strips sensitive fields (`password`, `token`, `secret`, `apiKey`) before storing drafts in browser storage.
- **Server-Side Verification**: Client validation provides immediate UX feedback only; all mutations must be re-validated on the server.

---

### 23. Reusable AI Evaluation & Benchmarking Toolkit
- **Status**: `READY`
- **Location**: [`src/lib/ai-eval/`](file:///c:/Users/rspma/Downloads/Hackathon-starter/src/lib/ai-eval/) & [`src/components/ai-eval/`](file:///c:/Users/rspma/Downloads/Hackathon-starter/src/components/ai-eval/)
- **Live Demo Route**: [`/dashboard/ai-eval`](file:///c:/Users/rspma/Downloads/Hackathon-starter/src/app/dashboard/ai-eval/page.tsx)
- **Reference Repositories Studied**:
  - `promptfoo/promptfoo`: Versioned datasets, evaluation assertions, side-by-side prompt/model comparisons, and CI integration.
  - `confident-ai/deepeval`: Metric evaluators (Groundedness, Faithfulness, Tool Call correctness, Rubric), test cases with threshold gating.
  - `explodinggradients/ragas`: Context groundedness, retrieval attribution, and token-overlap evaluation.
  - `langfuse/langfuse`: Traced execution scores, latency tracking, transparent token usage, and baseline comparisons.

#### Key Features & Architecture
- **Versioned Evaluation Datasets**: Evaluates versioned test suites conforming to semantic versioning schemas with Zod validation.
- **Modular Evaluator Types**:
  1. `exact-match`: Strict string equality.
  2. `normalized-text`: Case-insensitive, whitespace/punctuation-collapsed matching.
  3. `keyword`: Checks required presence and forbids forbidden tokens.
  4. `json-schema`: Verifies structured JSON (raw or markdown code block) against Zod schemas or required field keys.
  5. `tool-call`: Verifies correct tool name and argument schema conformance.
  6. `citation-groundedness`: Verifies `[doc-1]` citation presence and token overlap with retrieved documents. *(Note: Heuristic scores provide directional quality signals, not proof of factual correctness.)*
  7. `rubric`: Rule-based rubric checklist scoring (e.g. required sections, bullet points, length bounds).
  8. `prompt-injection-safety`: Verifies resistance to prompt injection, ensuring system instructions are not leaked and attacker exploit tokens (e.g. 'PWNED') are not returned.
  9. `latency`: Asserts response duration against configurable millisecond budgets.
- **Deterministic Mock Provider**: Includes `createMockProviderRunner` so test suites and hackathon developers can evaluate prompts without external model credentials or paid API costs.
- **Regression Gating & Thresholds**: Compares current runs against saved baselines, alerting when pass rates drop, average scores degrade, or latency increases beyond configured limits.
- **Automated Secret Scrubbing**: Redacts OpenAI keys (`sk-...`), Google keys (`AIza...`), Groq keys (`gsk_...`), Bearer tokens, and passwords from all exported reports (`redactSensitiveData`).

#### Usage Example

```typescript
import {
  EvaluationRunner,
  createMockProviderRunner,
  compareWithBaseline,
  formatMarkdownReport,
  DEFAULT_BENCHMARK_DATASET,
} from '@/lib/ai-eval'

// 1. Initialize runner with mock or real provider
const runner = new EvaluationRunner()
const mockRunner = createMockProviderRunner({ defaultLatencyMs: 15 })

// 2. Execute benchmark run
const report = await runner.run({
  dataset: DEFAULT_BENCHMARK_DATASET,
  providerRunner: mockRunner,
  model: 'mock-gpt-4o',
  provider: 'mock',
  promptVersion: 'v1.0.0',
})

console.log(`Pass Rate: ${(report.passRate * 100).toFixed(1)}%`)
console.log(`Average Latency: ${report.averageLatencyMs}ms`)

// 3. Compare with saved baseline to catch regressions
const comparison = compareWithBaseline(report, savedBaseline, {
  maxPassRateDrop: 0.05,
  maxScoreDrop: 0.05,
  maxLatencyIncreasePercent: 25,
})

if (comparison.regressionDetected) {
  console.warn('Regressions detected:', comparison.violations)
}

// 4. Export human-readable Markdown summary with secrets redacted
const markdownSummary = formatMarkdownReport(report, comparison)
console.log(markdownSummary)
```

#### Verification & Test Command
```bash
npm test tests/unit/ai-evaluation-toolkit.test.ts tests/components/ai-eval-dashboard.test.tsx
```












