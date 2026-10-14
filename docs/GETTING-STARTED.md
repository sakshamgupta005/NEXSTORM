# Getting Started with the Hackathon Starter

Welcome to the **Hackathon Starter** — a production-grade, domain-agnostic foundation engineered to let you launch demo-ready web and AI applications in hours.

---

## 1. Five-Minute Quickstart

```bash
# 1. Install dependencies
npm install

# 2. Run the baseline quality verification gate
npm run verify

# 3. Start the local development server with Turbopack
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to view the running starter.

---

## 2. Core Developer Commands

| Command | Purpose | Verification Stage |
| :--- | :--- | :--- |
| `npm run dev` | Start Next.js 16 local development server with Turbopack | Local Iteration |
| `npm test` | Run complete Vitest unit & component test suite | Fast Feedback (<10s) |
| `npm run typecheck` | Run TypeScript compiler type validation (`tsc --noEmit`) | Strict Type Safety |
| `npm run lint` | Run ESLint static analysis rules | Code Conventions |
| `npm run build` | Compile production Next.js bundle | Route & SSR Check |
| `npm run verify` | Run all 5 master quality gates sequentially | Pre-Commit / Pre-Push |
| `npm run smoke` | Probe `/api/health` and verify application boot | Deployment Liveness |
| `npm run release:check` | Run pre-flight deployment readiness audit | Cloud Readiness |
| `npm run hackathon:init` | Run capability selector for a problem statement | Hackathon Kickoff |

---

## 3. The Skeleton-First Philosophy

> **THE STARTER SERVES THE FUTURE PRODUCT. THE FUTURE PRODUCT DOES NOT SERVE THE STARTER.**

- Treat this repository as bones and joints.
- When your problem statement is revealed, select only what is needed with `npm run hackathon:init`.
- Keep core infrastructure (routing, health probes, security headers, logging).
- Replace starter demo templates with actual product screens.
- Missing credentials never crash the build; fallback offline mock adapters run deterministically.

---

## 4. Documentation Index

- [Hackathon-Day Operating Guide](file:///c:/Users/rspma/Downloads/Hackathon-starter/docs/HACKATHON-DAY-GUIDE.md) — Kickoff protocol and copy-ready Antigravity prompts.
- [Capability Catalog](file:///c:/Users/rspma/Downloads/Hackathon-starter/docs/CAPABILITY-CATALOG.md) — Inventory of all 52 ranked capabilities with test evidence.
- [Capability Integration Recipes](file:///c:/Users/rspma/Downloads/Hackathon-starter/docs/CAPABILITY-INTEGRATION.md) — Code recipes combining AI, RAG, forms, and auth.
- [System Architecture](file:///c:/Users/rspma/Downloads/Hackathon-starter/docs/ARCHITECTURE.md) — Directory layout and request lifecycle.
- [Deployment Guide](file:///c:/Users/rspma/Downloads/Hackathon-starter/docs/DEPLOYMENT.md) — Vercel, Render, and Docker deployment steps.
- [API Key Setup](file:///c:/Users/rspma/Downloads/Hackathon-starter/docs/API-KEY-SETUP.md) — Optional third-party API credential configuration.
- [Verification Report](file:///c:/Users/rspma/Downloads/Hackathon-starter/docs/VERIFICATION-REPORT.md) — Audit and test evidence for all 52 capabilities.
