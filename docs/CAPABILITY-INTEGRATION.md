# Capability Integration Patterns & Architecture

This guide details standard integration patterns for combining Hackathon Starter capabilities into cohesive, domain-specific products.

---

## 1. Integration Standards & Conventions

Every capability in this starter follows uniform conventions:

| Aspect | Standard Convention | Example |
| :--- | :--- | :--- |
| **Location** | Domain module in `src/lib/<domain>/` or `src/components/<domain>/` | `src/lib/ai/`, `src/components/geo/` |
| **Zero-Crash Boot** | Missing credentials never throw at import or module load | Reads `process.env` lazily via `getEnvConfig()` |
| **Fallback Adapters** | Provider clients support deterministic offline mock adapters | `createAIClient({ fallback: 'mock' })` |
| **Error Format** | Normalized `{ success: false, error: string, code?: string }` | `apiError('Bad request', 400, 'INVALID_INPUT')` |
| **Type Contracts** | Fully typed interfaces with optional Zod schemas | `src/lib/orchestration/types.ts` |
| **Verification** | Dedicated Vitest unit test with realistic fixtures | `tests/unit/<domain>.test.ts` |

---

## 2. Common Product Integration Recipes

### Recipe A: AI Assistant with Voice & Document RAG

Combine:
- `unified-ai-client` (`src/lib/ai/client.ts`)
- `rag-toolkit` (`src/lib/rag/`)
- `speech-toolkit` (`src/lib/speech/`)
- `state-views` (`src/components/ui/state-views.tsx`)

```typescript
import { createAIClient } from '@/lib/ai/client'
import { retrieveTopK, generateRagResponse } from '@/lib/rag'
import { transcribeAudio, synthesizeSpeech } from '@/lib/speech'

// 1. Ingest user voice
const { text: queryText } = await transcribeAudio(audioBlob, { fallback: 'mock' })

// 2. Retrieve relevant document context
const docs = await retrieveTopK(queryText, knowledgeIndex, 3)

// 3. Generate grounded answer
const aiClient = createAIClient({ fallback: 'mock' })
const answer = await generateRagResponse(queryText, docs, { client: aiClient })

// 4. Synthesize spoken response
const audioResponse = await synthesizeSpeech(answer.content, { fallback: 'mock' })
```

---

### Recipe B: Secure Multi-Step Form with Offline Sync

Combine:
- `forms-validation` (`src/lib/forms/`)
- `pwa-offline` (`src/lib/pwa/`)
- `sanitization` (`src/lib/security/sanitize.ts`)

```typescript
import { useMultiStepForm } from '@/lib/forms'
import { useOfflineSyncQueue } from '@/lib/pwa'
import { sanitizePlainText } from '@/lib/security/sanitize'

const { queueMutation, isOffline } = useOfflineSyncQueue('intake-queue')

async function handleStepSubmit(formData: Record<string, string>) {
  const sanitized = Object.fromEntries(
    Object.entries(formData).map(([k, v]) => [k, sanitizePlainText(v)])
  )

  if (isOffline) {
    queueMutation({ url: '/api/intake', method: 'POST', body: sanitized })
    return { queued: true }
  }

  return await fetch('/api/intake', { method: 'POST', body: JSON.stringify(sanitized) })
}
```

---

### Recipe C: Authenticated RBAC Workspace with Audit Logging

Combine:
- `supabase-auth-guard` (`src/lib/supabase/auth-guard.ts`)
- `auth-toolkit` (`src/lib/auth/authorization.ts`)
- `structured-logger` (`src/lib/logging/logger.ts`)

```typescript
import { requireServerUser } from '@/lib/supabase/auth-guard'
import { createAbility, requirePermission } from '@/lib/auth'
import { logger } from '@/lib/logging/logger'

export async function deleteProjectAction(projectId: string) {
  const user = await requireServerUser()
  const ability = createAbility(user)

  // Enforce ABAC permission
  requirePermission(ability, 'delete', 'Project', { projectId })

  logger.info('Project deleted by authorized user', {
    userId: user.id,
    projectId,
    action: 'delete'
  })

  return { success: true }
}
```

---

## 3. Provider Decoupling & Graceful Degradation

If external APIs (OpenAI, Supabase, Stripe, Mapbox) are down or unconfigured:
1. All client factories (`createAIClient`, `createAudioPipeline`, `DatabaseRepository`) feature built-in offline mock fallbacks.
2. In-memory data structures allow full end-to-end user journeys to run locally and pass test gates.
3. Live credentials can be introduced at any point in `.env.local` without code modifications.
