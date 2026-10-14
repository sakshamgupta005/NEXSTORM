# Modular Hackathon Capability Library: Part 1 Plan
## Focus Domain: Reliability, Security & Testing

This plan outlines the roadmap for hardening and modularizing the **Hackathon Starter** into a production-grade capability library, adhering to the skeleton-first principle: **The starter serves the future product; the future product does not serve the starter.**

---

## 1. Existing Capabilities & Actual Implementation Status

| Capability | Module Location | Existing Status | Test Coverage |
| :--- | :--- | :---: | :--- |
| **Safe Internal Redirects** | [`src/lib/utils/redirect.ts`](file:///c:/Users/rspma/Downloads/Hackathon-starter/src/lib/utils/redirect.ts) | `READY` | 11 tests in [`tests/unit/redirect.test.ts`](file:///c:/Users/rspma/Downloads/Hackathon-starter/tests/unit/redirect.test.ts) |
| **Resilient API Client (`safeFetch`)** | [`src/lib/api/client.ts`](file:///c:/Users/rspma/Downloads/Hackathon-starter/src/lib/api/client.ts) | `READY` | 5 tests in [`tests/unit/api-client.test.ts`](file:///c:/Users/rspma/Downloads/Hackathon-starter/tests/unit/api-client.test.ts) |
| **In-Memory Rate Limiter** | [`src/lib/security/rate-limit.ts`](file:///c:/Users/rspma/Downloads/Hackathon-starter/src/lib/security/rate-limit.ts) | `READY` | 3 tests in [`tests/unit/rate-limit.test.ts`](file:///c:/Users/rspma/Downloads/Hackathon-starter/tests/unit/rate-limit.test.ts) |
| **Zero-Crash Environment Registry** | [`src/lib/env.ts`](file:///c:/Users/rspma/Downloads/Hackathon-starter/src/lib/env.ts) | `READY` | 8 tests in [`tests/unit/env.test.ts`](file:///c:/Users/rspma/Downloads/Hackathon-starter/tests/unit/env.test.ts) + `env:check` |
| **Unified AI Client & Mock Mode** | [`src/lib/ai/client.ts`](file:///c:/Users/rspma/Downloads/Hackathon-starter/src/lib/ai/client.ts) | `READY` | 5 tests in [`tests/unit/ai-client.test.ts`](file:///c:/Users/rspma/Downloads/Hackathon-starter/tests/unit/ai-client.test.ts) |
| **Bounded Agent Workflow Engine** | [`src/lib/agent/workflow.ts`](file:///c:/Users/rspma/Downloads/Hackathon-starter/src/lib/agent/workflow.ts) | `READY` | 3 tests in [`tests/unit/agent-workflow.test.ts`](file:///c:/Users/rspma/Downloads/Hackathon-starter/tests/unit/agent-workflow.test.ts) |
| **Reusable UI State Views** | [`src/components/ui/state-views.tsx`](file:///c:/Users/rspma/Downloads/Hackathon-starter/src/components/ui/state-views.tsx) | `READY` | 4 tests in [`tests/components/state-views.test.tsx`](file:///c:/Users/rspma/Downloads/Hackathon-starter/tests/components/state-views.test.tsx) |
| **Supabase SSR Auth & Sessions** | [`src/lib/supabase/`](file:///c:/Users/rspma/Downloads/Hackathon-starter/src/lib/supabase/) | `READY` | 6 tests in [`config.test.ts`](file:///c:/Users/rspma/Downloads/Hackathon-starter/tests/unit/config.test.ts), [`ui.test.tsx`](file:///c:/Users/rspma/Downloads/Hackathon-starter/tests/components/ui.test.tsx), and E2E |
| **Baseline CI Pipeline** | [`.github/workflows/ci.yml`](file:///c:/Users/rspma/Downloads/Hackathon-starter/.github/workflows/ci.yml) | `READY` | Lint, Typecheck, Test, Build, E2E, `env:check` |

---

## 2. Gaps in Reliability, Security, Testing & CI

### 2.1 Security Gaps
1. **Missing Default Security Headers**: `next.config.ts` lacks standard response security headers (e.g. `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`).
2. **No Origin / CSRF Verification Helper**: Route Handlers currently have no reusable helper to verify request origin matches `NEXT_PUBLIC_SITE_URL` for state-changing mutations.
3. **No Input Sanitization Utility**: While Zod parses types, there is no generic sanitization helper to strip dangerous tags or control characters from user text before feeding to AI models or database storage.

### 2.2 Reliability Gaps
1. **Unstructured Console Logging**: Code currently relies on ad-hoc `console.error` without structured JSON, log levels (`debug`, `info`, `warn`, `error`), or automatic scrubbing of sensitive keys/tokens.
2. **Missing Next.js App Router Error Boundaries**: If a server or client component throws in production, there is no root or dashboard `error.tsx` fallback, leading to unstyled default Next.js error pages.
3. **Request Context & Client IP Extraction**: Rate limiting currently requires manual identifier passing; there is no standard helper to parse client IP reliably from `x-forwarded-for`, `x-real-ip`, or `cf-connecting-ip`.

### 2.3 Testing & CI Gaps
1. **Lack of Shared Test Fixtures**: Mocks for users, sessions, and API responses are duplicated across test files rather than imported from a standardized test fixture module.
2. **CI Lacks Failure Diagnostics**: [`.github/workflows/ci.yml`](file:///c:/Users/rspma/Downloads/Hackathon-starter/.github/workflows/ci.yml) does not upload Playwright test traces or screenshots when tests fail, making remote CI debugging difficult.
3. **No CI Concurrency Control**: Multiple rapid commits trigger concurrent CI runs without auto-canceling outdated queued builds.

---

## 3. Prioritized Implementation Plan (Small Milestones)

```
[Milestone 1.1: Security Headers & Request Context]
      │
      ▼
[Milestone 1.2: Structured Logger with Secret Masking]
      │
      ▼
[Milestone 1.3: Application Error Boundaries (error.tsx)]
      │
      ▼
[Milestone 1.4: Test Fixtures & Mock Utilities]
      │
      ▼
[Milestone 1.5: CI Diagnostics & Concurrency]
```

### Milestone 1.1 — Security Headers & Request Context
- **Purpose**: Enforce browser defense-in-depth headers and provide a unified utility to extract client IP and request IDs for rate limiting and logging.
- **Files Affected**:
  - `next.config.ts` (Add security headers config)
  - `src/lib/security/headers.ts` (Reusable security header definitions)
  - `src/lib/api/request-context.ts` (Extract client IP and request ID from `Request` / `NextRequest`)
- **Dependencies**: Native Web APIs (zero external packages).
- **Tests**:
  - `tests/unit/request-context.test.ts` (Verifies IP extraction across forward headers and request ID fallback)
  - `tests/unit/security-headers.test.ts` (Verifies header list structure)
- **Acceptance Criteria**:
  - `next.config.ts` applies `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and `Permissions-Policy`.
  - Request context correctly resolves IP from `x-forwarded-for`, `x-real-ip`, and fallback addresses.

### Milestone 1.2 — Structured Logger with Secret Scrubbing
- **Purpose**: Provide a lightweight, zero-dependency structured logger that formats JSON in production, includes request IDs, and automatically masks API keys, bearer tokens, and passwords.
- **Files Affected**:
  - `src/lib/logging/logger.ts`
- **Dependencies**: Native Web APIs (zero external packages).
- **Tests**:
  - `tests/unit/logger.test.ts` (Verifies log level filtering, JSON formatting, and automated token/secret redaction).
- **Acceptance Criteria**:
  - Log output masks values resembling `sk-...`, `Bearer ...`, or keys matching `ENV_REGISTRY`.
  - Respects `LOG_LEVEL` environment variable (`debug`, `info`, `warn`, `error`).

### Milestone 1.3 — Application Error Boundaries
- **Purpose**: Prevent white-screen crashes by providing resilient, accessible error boundaries with retry mechanisms.
- **Files Affected**:
  - `src/app/error.tsx` (Root route error boundary)
  - `src/app/global-error.tsx` (Global root layout error boundary)
  - Reuses existing `<ErrorState />` primitive from `src/components/ui/state-views.tsx`.
- **Dependencies**: `react`, `@/components/ui/state-views`.
- **Tests**:
  - `tests/components/error-boundary.test.tsx` (Verifies rendering error details, reset action, and logging integration).
- **Acceptance Criteria**:
  - Handles runtime errors gracefully without leaking raw stack traces in production.
  - Reset button attempts client-side re-render.

### Milestone 1.4 — Test Fixtures & Mock Utilities
- **Purpose**: Standardize mock data creation for users, Supabase sessions, and external API responses to accelerate hackathon test development.
- **Files Affected**:
  - `tests/fixtures/auth.ts` (Mock user, session, and token fixtures)
  - `tests/fixtures/api.ts` (Mock HTTP responses for common LLM and REST endpoints)
- **Dependencies**: None.
- **Tests**:
  - Validate fixtures in unit tests.
- **Acceptance Criteria**:
  - Provides type-safe mock generators without duplicating boilerplate.

### Milestone 1.5 — CI Diagnostics & Concurrency
- **Purpose**: Cancel superseded CI jobs and capture Playwright traces/screenshots on failure.
- **Files Affected**:
  - `.github/workflows/ci.yml`
- **Dependencies**: GitHub Actions `actions/upload-artifact@v4`.
- **Tests**: CI syntax and schema validation.
- **Acceptance Criteria**:
  - Adds `concurrency: { group: ..., cancel-in-progress: true }`.
  - Uploads Playwright report artifacts if E2E step fails.

---

## 4. Existing Functionality That Must Be Preserved

1. **Authentication & Supabase SSR**:
   - `src/app/auth/actions.ts`
   - `src/app/auth/callback/route.ts`
   - `src/app/auth/signout/route.ts`
   - `src/lib/supabase/client.ts` and `src/lib/supabase/server.ts`
   - `src/proxy.ts` (Next.js 16 session middleware proxy)
2. **Safe Redirect Validation**:
   - `src/lib/utils/redirect.ts` must remain untouched as the sole authority for redirect safety.
3. **Resilient API & AI Clients**:
   - `src/lib/api/client.ts` (`safeFetch`)
   - `src/lib/ai/client.ts` (`generateText`, `generateStructured`)
4. **Agent Workflow & UI Primitives**:
   - `src/lib/agent/workflow.ts`
   - `src/components/ui/` (`button`, `card`, `input`, `state-views`, etc.)
5. **Zero-Crash Environment Management**:
   - Unconfigured API keys must continue to work seamlessly in mock mode without breaking local dev or CI.

---

## 5. Risk Assessment & Mitigation

| Risk | Impact | Mitigation Strategy |
| :--- | :---: | :--- |
| **Strict CSP Breaking Inline Styles / Fonts** | High | Start with robust base security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`) before introducing restrictive `Content-Security-Policy` which can interfere with Next.js Turbopack inline scripts during hackathons. |
| **Logger Overhead in Serverless** | Low | Implement pure JSON synchronous formatting without background worker threads or file writes. |
| **Next.js 16 Proxy Middleware Breaking** | High | Keep `src/proxy.ts` strictly isolated for session handling; do not introduce heavy processing into the proxy. |

---

## 6. Exact First Implementation Milestone

**Milestone 1.1: Security Headers & Request Context**
1. Implement security headers configuration in `next.config.ts` via `src/lib/security/headers.ts`.
2. Implement request context extractor in `src/lib/api/request-context.ts` (extracting client IP and request ID for rate limiting and logging).
3. Add unit test suite in `tests/unit/request-context.test.ts` and `tests/unit/security-headers.test.ts`.
4. Verify with `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`.
