import type { StarterCapability, CapabilityCategory } from './types'

export const STARTER_CAPABILITIES: StarterCapability[] = [
  {
    id: 'safe-redirects',
    name: 'Safe Internal Redirects',
    category: 'Security',
    status: 'READY',
    location: 'src/lib/utils/redirect.ts',
    exports: ['getSafeRedirectPath', 'isSafeRedirectPath'],
    envKeys: [],
    testCommand: 'npm test tests/unit/redirect.test.ts',
    keywords: ['redirect', 'login', 'auth', 'security', 'open-redirect', 'navigation'],
    description: 'Validates redirect targets to prevent open-redirect attacks by rejecting absolute URLs and protocol-relative schemes.'
  },
  {
    id: 'api-client-resilience',
    name: 'Resilient API Client & Retry',
    category: 'Reliability',
    status: 'READY',
    location: 'src/lib/api/client.ts',
    exports: ['safeFetch', 'createApiClient', 'isApiError'],
    envKeys: [],
    testCommand: 'npm test tests/unit/api-client.test.ts',
    keywords: ['fetch', 'api', 'http', 'retry', 'backoff', 'timeout', 'resilience', 'client'],
    description: 'Safe HTTP client wrapping fetch with timeout, exponential backoff with jitter on 5xx/429, and Zod response validation.'
  },
  {
    id: 'structured-logger',
    name: 'Structured Server Logger & Secret Masking',
    category: 'Observability',
    status: 'READY',
    location: 'src/lib/logging/logger.ts',
    exports: ['logger', 'createLogger', 'maskSecrets'],
    envKeys: ['LOG_LEVEL'],
    testCommand: 'npm test tests/unit/logger.test.ts',
    keywords: ['log', 'logger', 'logging', 'secrets', 'redaction', 'observability', 'debug'],
    description: 'JSON structured logger with level filtering, correlation ID tracking, and recursive secret scrubbing.'
  },
  {
    id: 'api-response',
    name: 'Standardized API Responses',
    category: 'Reliability',
    status: 'READY',
    location: 'src/lib/api/response.ts',
    exports: ['apiSuccess', 'apiError', 'handleActionError'],
    envKeys: [],
    testCommand: 'npm test tests/unit/api-response.test.ts',
    keywords: ['api', 'response', 'error', 'json', 'server-action', 'route-handler'],
    description: 'Uniform JSON responses for Route Handlers and Server Actions with sanitization of internal server errors in production.'
  },
  {
    id: 'health-probes',
    name: 'Health & Readiness Probes',
    category: 'Reliability',
    status: 'READY',
    location: 'src/app/api/health/route.ts',
    exports: ['GET'],
    envKeys: [],
    testCommand: 'npm test tests/unit/health-route.test.ts',
    keywords: ['health', 'readiness', 'probe', 'uptime', 'devops', 'monitoring', 'status'],
    description: 'HTTP GET probe exposing uptime, healthy status, memory usage, and environment readiness for deploy orchestrators.'
  },
  {
    id: 'security-headers',
    name: 'HTTP Security Headers',
    category: 'Security',
    status: 'READY',
    location: 'src/lib/security/headers.ts',
    exports: ['getSecurityHeaders', 'securityHeadersMiddleware'],
    envKeys: [],
    testCommand: 'npm test tests/unit/security-headers.test.ts',
    keywords: ['headers', 'security', 'csp', 'hsts', 'xss', 'clickjacking', 'defense-in-depth'],
    description: 'Defense-in-depth headers including CSP, HSTS, X-Frame-Options, and X-Content-Type-Options.'
  },
  {
    id: 'rate-limiting',
    name: 'In-Memory Sliding-Window Rate Limiter',
    category: 'Security',
    status: 'READY',
    location: 'src/lib/security/rate-limit.ts',
    exports: ['rateLimit', 'createRateLimiter', 'getClientIp'],
    envKeys: [],
    testCommand: 'npm test tests/unit/rate-limit.test.ts',
    keywords: ['rate-limit', 'ddos', 'security', 'throttle', 'cost-control', 'burst'],
    description: 'Sliding-window counter rate limiter with proxy IP extraction and standard 429 Retry-After headers.'
  },
  {
    id: 'sanitization',
    name: 'Input & Output Sanitization',
    category: 'Security',
    status: 'READY',
    location: 'src/lib/security/sanitize.ts',
    exports: ['escapeHtml', 'stripHtmlTags', 'sanitizeFileName', 'sanitizePlainText'],
    envKeys: [],
    testCommand: 'npm test tests/unit/sanitize.test.ts',
    keywords: ['sanitize', 'xss', 'html', 'filename', 'security', 'clean'],
    description: 'Sanitizers preventing XSS attacks, path traversal in uploaded filenames, and control character injections.'
  },
  {
    id: 'file-upload-security',
    name: 'File Upload Security & Size Constraints',
    category: 'Security',
    status: 'READY',
    location: 'src/lib/security/upload.ts',
    exports: ['validateUploadedFile', 'isAllowedMimeType', 'MAX_UPLOAD_SIZE_BYTES'],
    envKeys: [],
    testCommand: 'npm test tests/unit/upload-validation.test.ts',
    keywords: ['upload', 'file', 'security', 'size-limit', 'mime-type', 'extension'],
    description: 'Enforces size limits and MIME type allowlists while blocking executable extensions for uploaded files.'
  },
  {
    id: 'supabase-auth-guard',
    name: 'Server Authentication Guard',
    category: 'Identity / Security',
    status: 'READY',
    location: 'src/lib/supabase/auth-guard.ts',
    exports: ['requireServerUser', 'getOptionalServerUser'],
    envKeys: ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'],
    testCommand: 'npm test tests/unit/auth-guard.test.ts',
    keywords: ['auth', 'supabase', 'guard', 'session', 'user', 'protected-route'],
    description: 'Server-verified session protection utilizing supabase.auth.getUser() to prevent unverified cookie spoofing.'
  },
  {
    id: 'unified-ai-client',
    name: 'Unified AI Client & Provider Adapters',
    category: 'AI / LLM',
    status: 'READY',
    location: 'src/lib/ai/client.ts',
    exports: ['createAIClient', 'generateText', 'generateStructured'],
    envKeys: ['OPENAI_API_KEY', 'GEMINI_API_KEY', 'GROQ_API_KEY'],
    testCommand: 'npm test tests/unit/ai-client.test.ts',
    keywords: ['ai', 'llm', 'openai', 'gemini', 'groq', 'structured-output', 'fallback', 'repair-loop'],
    description: 'Unified multi-provider client for text generation and structured JSON extraction with schema repair loops.'
  },
  {
    id: 'agent-workflow-engine',
    name: 'Bounded Agent Workflow Engine',
    category: 'Agents',
    status: 'READY',
    location: 'src/lib/agent/workflow.ts',
    exports: ['WorkflowEngine', 'createStep', 'executeWorkflow'],
    envKeys: [],
    testCommand: 'npm test tests/unit/agent-workflow.test.ts',
    keywords: ['agent', 'workflow', 'pipeline', 'bounded', 'steps', 'orchestration'],
    description: 'State-machine workflow runner executing step-by-step agent workflows with timeouts and cancellation signals.'
  },
  {
    id: 'agent-tool-registry',
    name: 'Generic Tool Registry & Harness',
    category: 'Agents',
    status: 'READY',
    location: 'src/lib/agent/tools.ts',
    exports: ['ToolRegistry', 'defineTool'],
    envKeys: [],
    testCommand: 'npm test tests/unit/agent-loop.test.ts',
    keywords: ['tool', 'registry', 'harness', 'agent', 'functions', 'schema'],
    description: 'Type-safe registry validating model-callable tool arguments with Zod before running, with timeouts and side-effect flags.'
  },
  {
    id: 'agent-loop',
    name: 'Bounded Autonomous Agent Loop',
    category: 'Agents',
    status: 'READY',
    location: 'src/lib/agent/loop.ts',
    exports: ['runAgentLoop', 'createAgentAction'],
    envKeys: [],
    testCommand: 'npm test tests/unit/agent-loop.test.ts',
    keywords: ['loop', 'agent', 'bounded', 'autonomous', 'iteration-cap', 'stop-reason'],
    description: 'Autonomous execution loop with iteration caps, error counters, and non-retryable mutating actions.'
  },
  {
    id: 'agent-checkpoints',
    name: 'Workflow Checkpoints & Resumability',
    category: 'Agents',
    status: 'READY',
    location: 'src/lib/agent/checkpoint.ts',
    exports: ['CheckpointStore', 'createInMemoryCheckpointStore'],
    envKeys: [],
    testCommand: 'npm test tests/unit/agent-checkpoint.test.ts',
    keywords: ['checkpoint', 'resume', 'state', 'persistence', 'history', 'agent'],
    description: 'State snapshotting engine enabling agent paused states, rollbacks, and recovery after interruptions.'
  },
  {
    id: 'agent-orchestrator',
    name: 'AI Planner, Improvement Loops & Gates',
    category: 'Agents',
    status: 'READY',
    location: 'src/lib/agent/orchestrator.ts',
    exports: ['runOrchestrationTask', 'createStructuredPlan', 'QualityGateSuite'],
    envKeys: [],
    testCommand: 'npm test tests/unit/agent-orchestrator.test.ts',
    keywords: ['orchestrator', 'planner', 'gates', 'improvement-loop', 'autonomous', 'human-approval'],
    description: 'Autonomous goal planner with dependency DAG ordering, gate checks, and human-in-the-loop approvals for destructive operations.'
  },
  {
    id: 'integrations-framework',
    name: 'Modular Integration Framework & Adapters',
    category: 'Integrations',
    status: 'READY',
    location: 'src/lib/integrations/',
    exports: ['IntegrationRegistry', 'createIntegrationRegistry'],
    envKeys: [],
    testCommand: 'npm test tests/unit/integration-registry.test.ts',
    keywords: ['integration', 'adapters', 'plugins', 'third-party', 'registry', 'webhooks'],
    description: 'Pluggable integration engine managing external provider adapters, health statuses, and credentials.'
  },
  {
    id: 'rag-toolkit',
    name: 'Reusable RAG & Document Intelligence Toolkit',
    category: 'AI / RAG',
    status: 'READY',
    location: 'src/lib/rag/',
    exports: ['chunkDocument', 'createEmbeddingIndex', 'retrieveTopK', 'generateRagResponse'],
    envKeys: ['OPENAI_API_KEY'],
    testCommand: 'npm test tests/unit/rag-toolkit.test.ts',
    keywords: ['rag', 'retrieval', 'embeddings', 'vector', 'documents', 'semantic-search'],
    description: 'Text chunking, similarity indexing, in-memory cosine ranking, and context-augmented answer generation.'
  },
  {
    id: 'speech-toolkit',
    name: 'Reusable Speech & Voice Toolkit',
    category: 'Voice / Audio',
    status: 'READY',
    location: 'src/lib/speech/',
    exports: ['transcribeAudio', 'synthesizeSpeech', 'createAudioPipeline'],
    envKeys: ['OPENAI_API_KEY', 'ELEVENLABS_API_KEY'],
    testCommand: 'npm test tests/unit/speech-toolkit.test.ts',
    keywords: ['speech', 'voice', 'stt', 'tts', 'transcription', 'audio', 'whisper'],
    description: 'Speech-to-text and text-to-speech pipelines with fallback mocks and browser audio recording hooks.'
  },
  {
    id: 'vision-toolkit',
    name: 'Reusable OCR & Multimodal Vision Toolkit',
    category: 'AI / Vision',
    status: 'READY',
    location: 'src/lib/vision/',
    exports: ['extractDocumentOcr', 'analyzeImageMultimodal'],
    envKeys: ['OPENAI_API_KEY', 'GEMINI_API_KEY'],
    testCommand: 'npm test tests/unit/ocr-vision-toolkit.test.ts',
    keywords: ['vision', 'ocr', 'image', 'multimodal', 'document-scan', 'receipt', 'camera'],
    description: 'OCR document parsing and image analysis extracting structured key-value pairs using multimodal models.'
  },
  {
    id: 'search-toolkit',
    name: 'Reusable Web Search & Data Scraping Toolkit',
    category: 'AI / Search',
    status: 'READY',
    location: 'src/lib/search/',
    exports: ['searchWeb', 'scrapeWebPage', 'searchAndSynthesize'],
    envKeys: ['TAVILY_API_KEY', 'BRAVE_SEARCH_API_KEY'],
    testCommand: 'npm test tests/unit/search-toolkit.test.ts',
    keywords: ['search', 'web-search', 'tavily', 'brave', 'scraper', 'research', 'citations'],
    description: 'Search aggregation, web page scraping, and citation synthesis with fallback deterministic mock adapters.'
  },
  {
    id: 'auth-toolkit',
    name: 'Reusable Auth & Authorization Toolkit (RBAC/ABAC)',
    category: 'Identity / Security',
    status: 'READY',
    location: 'src/lib/auth/',
    exports: ['hashPassword', 'verifyPassword', 'createAbility', 'requireRole', 'requirePermission'],
    envKeys: [],
    testCommand: 'npm test tests/unit/auth-toolkit.test.ts',
    keywords: ['auth', 'rbac', 'abac', 'permissions', 'sessions', 'password', 'oauth', 'roles'],
    description: 'Scrypt password hashing, session tokens, CASL-style declarative permissions, and React authorization components.'
  },
  {
    id: 'ui-components',
    name: 'Accessible UI Component Library',
    category: 'UI Patterns',
    status: 'READY',
    location: 'src/components/ui/',
    exports: ['Button', 'Card', 'Badge', 'Input', 'Modal', 'Select', 'Tabs'],
    envKeys: [],
    testCommand: 'npm test tests/components/ui-library.test.tsx',
    keywords: ['ui', 'components', 'button', 'card', 'modal', 'tabs', 'dialog', 'form'],
    description: 'Accessible, responsive UI primitives styled with Tailwind CSS v4 and keyboard navigation support.'
  },
  {
    id: 'data-components',
    name: 'Data Presentation Components',
    category: 'Data & State',
    status: 'READY',
    location: 'src/components/ui/',
    exports: ['DataTable', 'SearchBar', 'FileUploadZone', 'Pagination'],
    envKeys: [],
    testCommand: 'npm test tests/components/ui-library.test.tsx',
    keywords: ['table', 'datatable', 'search', 'upload', 'pagination', 'data-view'],
    description: 'Interactive data components: searchable and sortable tables, file dropzones, and paginated lists.'
  },
  {
    id: 'layout-shells',
    name: 'Application Layouts & Shells',
    category: 'UI Layouts',
    status: 'READY',
    location: 'src/components/layout/',
    exports: ['AppShell', 'PageHeader', 'Navbar', 'Footer'],
    envKeys: [],
    testCommand: 'npm test tests/components/layout-templates.test.tsx',
    keywords: ['layout', 'shell', 'navbar', 'footer', 'sidebar', 'header', 'page-shell'],
    description: 'Responsive desktop/mobile layouts with breadcrumbs, collapsible navigation, and user status indicators.'
  },
  {
    id: 'page-templates',
    name: 'Reusable Page Templates',
    category: 'UI Patterns',
    status: 'READY',
    location: 'src/components/templates/',
    exports: ['DashboardTemplate', 'DetailTemplate', 'ListTemplate', 'SettingsTemplate'],
    envKeys: [],
    testCommand: 'npm test tests/components/layout-templates.test.tsx',
    keywords: ['template', 'page', 'dashboard', 'settings', 'detail', 'list', 'screen'],
    description: 'Ready-to-use page scaffolds for common hackathon product screens (dashboard, list view, settings).'
  },
  {
    id: 'state-views',
    name: 'Page-Level States & Banners',
    category: 'UI Patterns',
    status: 'READY',
    location: 'src/components/ui/state-views.tsx',
    exports: ['EmptyState', 'LoadingState', 'ErrorState', 'SetupBanner'],
    envKeys: [],
    testCommand: 'npm test tests/components/layout-templates.test.tsx',
    keywords: ['empty-state', 'loading-state', 'error-state', 'banner', 'feedback'],
    description: 'Empty states with recovery actions, skeleton loading wrappers, and setup assistance banners.'
  },
  {
    id: 'frontend-data-layer',
    name: 'Frontend Data Layer & Async Hooks',
    category: 'Data & State',
    status: 'READY',
    location: 'src/hooks/',
    exports: ['useAsyncData', 'useDebounce', 'useLocalStorage', 'CacheStore'],
    envKeys: [],
    testCommand: 'npm test tests/components/frontend-data-layer.test.tsx',
    keywords: ['hooks', 'async', 'cache', 'debounce', 'localstorage', 'state'],
    description: 'Async data fetching hooks with in-memory caching, optimistic updates, and input debouncing.'
  },
  {
    id: 'realtime-transport',
    name: 'Real-Time WebSocket & SSE Consumer',
    category: 'Real-Time / Data',
    status: 'READY',
    location: 'src/lib/realtime/',
    exports: ['useWebSocket', 'useServerSentEvents', 'RealtimeClient'],
    envKeys: [],
    testCommand: 'npm test tests/components/realtime.test.tsx',
    keywords: ['realtime', 'websocket', 'sse', 'events', 'live', 'stream'],
    description: 'Real-time client for WebSocket connections and Server-Sent Events with automated reconnect and heartbeats.'
  },
  {
    id: 'error-boundaries',
    name: 'Application Error Boundaries',
    category: 'Reliability',
    status: 'READY',
    location: 'src/app/error.tsx',
    exports: ['default'],
    envKeys: [],
    testCommand: 'npm test tests/components/error-boundary.test.tsx',
    keywords: ['error', 'boundary', 'crash', 'recovery', 'layout-error'],
    description: 'Next.js error boundaries preventing blank screen crashes with user-facing recovery buttons.'
  },
  {
    id: 'test-fixtures',
    name: 'Reusable Test Fixtures & Mock Generators',
    category: 'QA / Testing',
    status: 'READY',
    location: 'tests/fixtures/',
    exports: ['createMockUser', 'createMockSession', 'createMockApiResponse'],
    envKeys: [],
    testCommand: 'npm test tests/unit/fixtures.test.ts',
    keywords: ['fixtures', 'mocks', 'testing', 'generators', 'seed-data'],
    description: 'Generators for realistic mock users, auth tokens, responses, and API payloads for deterministic tests.'
  },
  {
    id: 'zero-crash-env',
    name: 'Zero-Crash Environment Management',
    category: 'Reliability',
    status: 'READY',
    location: 'src/lib/env.ts',
    exports: ['getEnvConfig', 'validateEnv', 'hasRequiredEnv'],
    envKeys: [],
    testCommand: 'npm test tests/unit/env.test.ts',
    keywords: ['env', 'environment', 'config', 'validation', 'secrets', 'zero-crash'],
    description: 'Validates presence and placeholder patterns in environment variables without crashing in development or tests.'
  },
  {
    id: 'supabase-integration',
    name: 'Supabase Auth & Session Refresh',
    category: 'Identity / Security',
    status: 'READY',
    location: 'src/lib/supabase/',
    exports: ['createClient', 'createClientServer', 'updateSession'],
    envKeys: ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'],
    testCommand: 'npm test tests/unit/supabase.test.ts',
    keywords: ['supabase', 'postgres', 'database', 'auth', 'cookies', 'pkce'],
    description: 'Next.js App Router Supabase client integration with cookie refresh middleware and PKCE flows.'
  },
  {
    id: 'ci-pipeline',
    name: 'CI Workflow with Diagnostics & Concurrency',
    category: 'DevOps / CI',
    status: 'READY',
    location: '.github/workflows/ci.yml',
    exports: [],
    envKeys: [],
    testCommand: 'npm run verify',
    keywords: ['ci', 'github-actions', 'pipeline', 'workflow', 'devops'],
    description: 'GitHub Actions continuous integration pipeline running typechecks, linting, tests, and build checks.'
  },
  {
    id: 'database-storage-cache',
    name: 'Reusable Database, Storage & Cache Toolkit',
    category: 'Data / Persistence',
    status: 'READY',
    location: 'src/lib/database/',
    exports: ['DatabaseRepository', 'StorageBucket', 'MemoryCache', 'RedisCache'],
    envKeys: ['DATABASE_URL', 'REDIS_URL'],
    testCommand: 'npm test tests/unit/database-storage-cache.test.ts',
    keywords: ['database', 'storage', 'cache', 'redis', 'blob', 'repository', 'crud'],
    description: 'Unified CRUD repository abstraction, S3/Supabase blob storage client, and LRU memory/Redis caching.'
  },
  {
    id: 'maps-geospatial',
    name: 'Reusable Maps, Geolocation & Routing Toolkit',
    category: 'Geospatial / UI',
    status: 'READY',
    location: 'src/lib/geo/',
    exports: ['calculateDistance', 'geocodeAddress', 'MapView', 'useUserLocation'],
    envKeys: ['NEXT_PUBLIC_MAPBOX_TOKEN'],
    testCommand: 'npm test tests/unit/maps-geospatial-toolkit.test.ts',
    keywords: ['maps', 'geo', 'geolocation', 'routing', 'distance', 'gps', 'coordinates'],
    description: 'Haversine distance calculation, geocoding helpers, location watch hooks, and Leaflet/Mapbox UI wrappers.'
  },
  {
    id: 'payments-webhooks',
    name: 'Reusable Payments & Webhook Toolkit',
    category: 'Payments / Webhooks',
    status: 'READY',
    location: 'src/lib/payments/',
    exports: ['createCheckoutSession', 'verifyWebhookSignature', 'handlePaymentEvent'],
    envKeys: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
    testCommand: 'npm test tests/unit/payments-webhook-toolkit.test.ts',
    keywords: ['payments', 'stripe', 'checkout', 'billing', 'subscription', 'webhooks'],
    description: 'Stripe checkout session creation, cryptographically verified webhook handlers, and test event fixtures.'
  },
  {
    id: 'background-jobs',
    name: 'Reusable Background Jobs & Workflow Toolkit',
    category: 'Async / Workflows',
    status: 'READY',
    location: 'src/lib/jobs/',
    exports: ['JobQueue', 'createJobQueue', 'defineWorker'],
    envKeys: [],
    testCommand: 'npm test tests/unit/jobs-workflow-toolkit.test.ts',
    keywords: ['jobs', 'queue', 'workers', 'background', 'async', 'cron', 'delayed-tasks'],
    description: 'In-memory / Redis task queues with retry limits, exponential backoff, dead-letter recording, and worker pools.'
  },
  {
    id: 'notifications-messaging',
    name: 'Reusable Notifications & Messaging Toolkit',
    category: 'Messaging / Alerts',
    status: 'READY',
    location: 'src/lib/notifications/',
    exports: ['sendNotification', 'NotificationCenter', 'createEmailProvider'],
    envKeys: ['RESEND_API_KEY', 'TWILIO_AUTH_TOKEN'],
    testCommand: 'npm test tests/unit/notifications-toolkit.test.ts',
    keywords: ['notifications', 'email', 'sms', 'alerts', 'toast', 'resend', 'twilio'],
    description: 'Multi-channel notification dispatcher supporting email, SMS, push alerts, and in-app bell feeds.'
  },
  {
    id: 'observability-telemetry',
    name: 'Reusable Observability, Tracing & Metrics Toolkit',
    category: 'Observability',
    status: 'READY',
    location: 'src/lib/observability/',
    exports: ['recordMetric', 'startSpan', 'getTelemetryReport'],
    envKeys: [],
    testCommand: 'npm test tests/unit/observability-toolkit.test.ts',
    keywords: ['observability', 'metrics', 'tracing', 'telemetry', 'performance', 'latency'],
    description: 'Lightweight distributed tracing spans, latency timers, and in-memory counters with OpenTelemetry-compatible structures.'
  },
  {
    id: 'realtime-collaboration',
    name: 'Reusable Realtime Collaboration Toolkit',
    category: 'Real-Time / Collab',
    status: 'READY',
    location: 'src/lib/realtime/',
    exports: ['useRealtimeRoom', 'RoomPresence', 'BroadcastChannel'],
    envKeys: [],
    testCommand: 'npm test tests/unit/realtime-collaboration.test.ts',
    keywords: ['collaboration', 'presence', 'multiplayer', 'cursors', 'rooms', 'sync'],
    description: 'Multiplayer room presence, live user cursor tracking, broadcast messaging, and conflict-free field updates.'
  },
  {
    id: 'computer-vision-video',
    name: 'Reusable Computer Vision & Video Toolkit',
    category: 'Vision / Video',
    status: 'READY',
    location: 'src/lib/vision/',
    exports: ['CameraPreview', 'captureFrame', 'analyzeVideoStream'],
    envKeys: [],
    testCommand: 'npm test tests/unit/computer-vision-toolkit.test.ts',
    keywords: ['video', 'camera', 'webcam', 'frames', 'vision', 'object-detection', 'stream'],
    description: 'HTML5 webcam stream controller, canvas snapshot extractor, and frame-by-frame multimodal inference.'
  },
  {
    id: 'export-reporting',
    name: 'Reusable Export, Reporting & Document Generation',
    category: 'Export / Reporting',
    status: 'READY',
    location: 'src/lib/export/',
    exports: ['exportToCsv', 'exportToJson', 'generatePdfReport', 'useFileDownload'],
    envKeys: [],
    testCommand: 'npm test tests/unit/export-reporting-toolkit.test.ts',
    keywords: ['export', 'csv', 'pdf', 'json', 'reports', 'download', 'generator'],
    description: 'In-browser CSV/JSON generation, sanitized report building, and automatic blob download triggers.'
  },
  {
    id: 'testing-automation',
    name: 'Reusable Testing & Quality Automation Toolkit',
    category: 'QA / Quality Gates',
    status: 'READY',
    location: 'src/lib/testing/',
    exports: ['runQualityAudit', 'evaluateCoverage', 'generateMockScenario'],
    envKeys: [],
    testCommand: 'npm test tests/unit/testing-automation-toolkit.test.ts',
    keywords: ['quality', 'audit', 'gates', 'testing', 'smoke-test', 'verification'],
    description: 'Quality audit runner asserting lint, typecheck, test coverage, and security requirements.'
  },
  {
    id: 'feature-flags',
    name: 'Reusable Feature Flags & Runtime Configuration',
    category: 'Config / Flags',
    status: 'READY',
    location: 'src/lib/config/',
    exports: ['isFeatureEnabled', 'useFeatureFlag', 'FeatureGate'],
    envKeys: [],
    testCommand: 'npm test tests/unit/feature-flags-runtime-config.test.ts',
    keywords: ['feature-flags', 'flags', 'toggles', 'config', 'experiments', 'rollout'],
    description: 'Environment- and user-targeted feature flags with fallback defaults, percentage rollouts, and React gates.'
  },
  {
    id: 'api-resilience-advanced',
    name: 'Advanced API Circuit Breaker & Resilience',
    category: 'API / Resilience',
    status: 'READY',
    location: 'src/lib/api/resilience.ts',
    exports: ['CircuitBreaker', 'withCircuitBreaker', 'FallbackProvider'],
    envKeys: [],
    testCommand: 'npm test tests/unit/api-resilience-toolkit.test.ts',
    keywords: ['circuit-breaker', 'resilience', 'fallback', 'fault-tolerance', 'failover'],
    description: 'Stateful circuit breaker (closed/open/half-open) preventing cascading failures when external APIs become unavailable.'
  },
  {
    id: 'data-visualization',
    name: 'Reusable Data Visualization & Dashboard Toolkit',
    category: 'UI / Analytics',
    status: 'READY',
    location: 'src/lib/visualization/',
    exports: ['BarChart', 'LineChart', 'MetricCard', 'DashboardGrid'],
    envKeys: [],
    testCommand: 'npm test tests/unit/data-visualization.test.ts',
    keywords: ['charts', 'visualization', 'graphs', 'dashboard', 'analytics', 'metrics', 'kpi'],
    description: 'Responsive SVG/canvas-free charts (bar, line, sparklines) and KPI metric cards with change indicators.'
  },
  {
    id: 'i18n-localization-a11y',
    name: 'Reusable i18n, Localization & Accessibility Toolkit',
    category: 'i18n / a11y',
    status: 'READY',
    location: 'src/lib/i18n/',
    exports: ['I18nProvider', 'useTranslation', 'formatCurrency', 'formatDate', 'A11yAnnouncer'],
    envKeys: [],
    testCommand: 'npm test tests/unit/i18n-localization.test.ts',
    keywords: ['i18n', 'localization', 'translation', 'a11y', 'accessibility', 'screen-reader', 'aria'],
    description: 'Zero-dependency internationalization dictionary provider, currency/date formatters, and screen-reader announcers.'
  },
  {
    id: 'pwa-offline',
    name: 'Reusable PWA & Offline Support Toolkit',
    category: 'Offline / PWA',
    status: 'READY',
    location: 'src/lib/pwa/',
    exports: ['useNetworkStatus', 'useOfflineSyncQueue', 'PwaInstallPrompt', 'OfflineBanner'],
    envKeys: [],
    testCommand: 'npm test tests/unit/pwa-offline.test.ts',
    keywords: ['pwa', 'offline', 'service-worker', 'manifest', 'sync', 'cache-storage'],
    description: 'Offline detection, queueing mutations while offline with automatic replay upon reconnection, and install prompt banner.'
  },
  {
    id: 'forms-validation',
    name: 'Reusable Forms & Multi-Step Validation Toolkit',
    category: 'Forms / Validation',
    status: 'READY',
    location: 'src/lib/forms/',
    exports: ['useMultiStepForm', 'FormStep', 'createStepValidator', 'FormField'],
    envKeys: [],
    testCommand: 'npm test tests/unit/forms-validation.test.ts',
    keywords: ['forms', 'validation', 'multi-step', 'wizard', 'inputs', 'zod', 'draft-save'],
    description: 'Multi-step wizard state machine with draft persistence, per-step validation, and accessible form fields.'
  },
  {
    id: 'ai-evaluation',
    name: 'Reusable AI Evaluation & Benchmarking Toolkit',
    category: 'AI / Benchmarks',
    status: 'READY',
    location: 'src/lib/ai-eval/',
    exports: ['runEvaluationSuite', 'evaluateExactMatch', 'evaluateSemanticSimilarity', 'EvalDashboard'],
    envKeys: [],
    testCommand: 'npm test tests/unit/ai-evaluation-toolkit.test.ts',
    keywords: ['evaluation', 'benchmarking', 'metrics', 'promptfoo', 'deepeval', 'ragas', 'grounding'],
    description: 'Automated evaluation suite comparing model outputs against golden datasets, computing accuracy and latency.'
  },
  {
    id: 'deployment-release',
    name: 'Reusable Deployment & Release Toolkit',
    category: 'DevOps / Release',
    status: 'READY',
    location: 'src/lib/release/',
    exports: ['runReleaseChecks', 'runSmokeProbe', 'generateReleaseReport'],
    envKeys: [],
    testCommand: 'npm test tests/unit/deployment-release-toolkit.test.ts',
    keywords: ['deployment', 'release', 'docker', 'vercel', 'render', 'smoke-test', 'production'],
    description: 'Automated pre-flight release readiness validation, Docker container readiness, and production HTTP smoke testing.'
  }
]

export function getAllCapabilities(): StarterCapability[] {
  return STARTER_CAPABILITIES
}

export function findCapabilityById(id: string): StarterCapability | undefined {
  return STARTER_CAPABILITIES.find(c => c.id === id)
}

export function getCapabilitiesByCategory(category: CapabilityCategory): StarterCapability[] {
  return STARTER_CAPABILITIES.filter(c => c.category === category)
}

export function searchCapabilities(query: string): StarterCapability[] {
  const q = query.toLowerCase().trim()
  if (!q) return STARTER_CAPABILITIES
  return STARTER_CAPABILITIES.filter(c => {
    return (
      c.name.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q) ||
      c.keywords.some(k => k.toLowerCase().includes(q))
    )
  })
}
