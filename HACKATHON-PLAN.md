# Hackathon Project Plan: AI Telehealth Triage & Voice Diagnosis Assistant

**Generated:** 2026-10-12T17:52:34.758Z
**Description:** A voice-first rural triage assistant enabling clinical intake, offline record capture, and AI symptom summaries.

> Skeleton-First Principle: The starter serves the future product. Keep only what proves the product.

## 1. Selected Capabilities

| Capability | Domain | Action | Note |
| :--- | :--- | :---: | :--- |
| **Safe Internal Redirects** | Security | `KEEP` | Ready in starter codebase |
| **Resilient API Client** | Reliability | `KEEP` | Ready in starter codebase |
| **Structured Logger & Redaction** | Observability | `KEEP` | Ready in starter codebase |
| **Standardized API Responses** | Reliability | `KEEP` | Ready in starter codebase |
| **Health & Readiness Probes** | Reliability | `KEEP` | Ready in starter codebase |
| **HTTP Security Headers** | Security | `KEEP` | Ready in starter codebase |
| **Input & Output Sanitization** | Security | `KEEP` | Ready in starter codebase |
| **Unified AI Client & Adapters** | AI / LLM | `KEEP` | Ready in starter codebase |
| **AI Planner & Improvement Loop** | Agents | `KEEP` | Ready in starter codebase |
| **Speech & Voice Toolkit** | Voice / Audio | `KEEP` | Ready in starter codebase |
| **Database, Storage & Caching** | Data / Persistence | `KEEP` | Ready in starter codebase |
| **Maps & Geolocation** | Geospatial / UI | `KEEP` | Ready in starter codebase |
| **PWA & Offline Support** | Offline / PWA | `KEEP` | Ready in starter codebase |
| **Forms & Multi-Step Validation** | Forms / Validation | `KEEP` | Ready in starter codebase |
| **Deployment & Release Toolkit** | DevOps / Release | `KEEP` | Ready in starter codebase |

## 2. Environment Status

- ⚠️ `LOG_LEVEL`: Unset (offline mocks will run deterministically).
- ⚠️ `OPENAI_API_KEY`: Unset (offline mocks will run deterministically).
- ⚠️ `GEMINI_API_KEY`: Unset (offline mocks will run deterministically).
- ⚠️ `DATABASE_URL`: Unset (offline mocks will run deterministically).
- ⚠️ `NEXT_PUBLIC_MAPBOX_TOKEN`: Unset (offline mocks will run deterministically).

## 3. Prioritized Milestones

1. [P1] **Baseline Check**: Verify environment and test suite health (`npm test`).
2. [P1] **Domain Models**: Define data schemas in `src/types/` and Zod validations.
3. [P2] **Core Engine / API**: Wire services with fallback offline mock support.
4. [P2] **UI Integration**: Build user screens using AppShell and starter UI primitives.
5. [P3] **End-to-End Verification**: Write integration test exercising user demo journey.
6. [P4] **Pre-Flight Release Check**: Run `npm run release:check` and verify health probe.

## 4. Verification Commands
- Unit tests: `npm test`
- Typecheck:  `npm run typecheck`
- Build check: `npm run build`
- Smoke probe: `npm run smoke`
- Master gate: `npm run verify`
