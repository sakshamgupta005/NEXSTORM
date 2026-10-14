# Hackathon Starter — Reusable Technical Foundation

> **GOVERNING DIRECTIVE**:
> **THE STARTER SERVES THE FUTURE PRODUCT. THE FUTURE PRODUCT DOES NOT SERVE THE STARTER.**
> This repository is a reusable technical skeleton designed to be cloned or copied for future hackathons. It is NOT a standalone SaaS product, an MVP, or an end-user application.

---

## 1. What This Repository Is (and Is Not)

- **What it IS**:
  - The "bones and internal systems" of an application: routing, authentication session handling, type safety, environment validation, testing pipelines, and responsive layouts.
  - A clean starting baseline designed for rapid transformation when a hackathon challenge brief is provided.
- **What it IS NOT**:
  - A finished product with invented domain workflows or fake business data.
  - A rigid architecture: authentication, databases, and AI providers are modular capabilities to keep or remove as your specific challenge requires.

---

## 2. Technology Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router, Turbopack, React 19)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (strict mode)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) with semantic CSS variables
- **UI Components**: Accessible primitives styled in the shadcn/ui pattern (`src/components/ui/`)
- **Authentication & Database**: [Supabase](https://supabase.com/) via official `@supabase/ssr` (Edge proxy session refresh, cookies, and PKCE callback)
- **Validation**: [Zod](https://zod.dev/) for form and input schemas
- **Testing**: [Vitest](https://vitest.dev/) (unit & component tests) and [Playwright](https://playwright.dev/) (E2E browser smoke tests)
- **Continuous Integration**: GitHub Actions (`.github/workflows/ci.yml`)

---

## 3. Getting Started Locally

### Prerequisites
- Node.js 20+ (tested on Node 22 & 24)
- npm 10+

### Installation & Run

```bash
# 1. Clone or copy into your workspace
git clone https://github.com/sakshamgupta005/Hackathon-starter.git
cd Hackathon-starter

# 2. Install dependencies
npm install

# 3. Start local development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to view the infrastructure verification screen.

---

## 4. Environment Variables & Secret Management

Copy the documented template:

```bash
cp .env.example .env.local
```

Fill in **only the keys required by your project**. The starter is designed to boot safely in preview mode without crashing if optional provider keys are absent.

### Safe Offline Environment Check

Run the offline diagnostic tool to check which providers are configured:

```bash
npm run env:check
```

- **What it checks**: Validates that required syntax and non-placeholder values exist in `.env.local`.
- **What it CANNOT check**: It does **not** make live network calls and does **not** verify whether your provider account has active billing credits or valid quota. You must verify credits on the provider's dashboard.

---

## 5. Verification & Test Commands

Always verify changes using the standard npm scripts:

| Command | Purpose |
| :--- | :--- |
| `npm run lint` | Runs ESLint across all source and test files. |
| `npm run typecheck` | Runs TypeScript compiler checks without emitting files (`tsc --noEmit`). |
| `npm test` | Runs the Vitest unit and component test suite. |
| `npm run test:watch` | Starts interactive Vitest runner for test-driven development. |
| `npm run test:e2e` | Runs Playwright browser smoke tests (Chromium). |
| `npm run build` | Compiles production bundle with Next.js Turbopack. |
| `npm run env:check` | Inspects local environment configuration without leaking secrets. |

### Reusable Test Fixtures & Offline Testing

The test harness is designed to execute **100% offline** without live provider credentials or billable API costs:
- **Auth Fixtures** ([`tests/fixtures/auth.ts`](file:///c:/Users/rspma/Downloads/Hackathon-starter/tests/fixtures/auth.ts)): Deterministic mock users, sessions, and tokens.
- **API Fixtures** ([`tests/fixtures/api.ts`](file:///c:/Users/rspma/Downloads/Hackathon-starter/tests/fixtures/api.ts)): Mock JSON, error, and streaming HTTP responses.
- **AI Fixtures** ([`tests/fixtures/ai.ts`](file:///c:/Users/rspma/Downloads/Hackathon-starter/tests/fixtures/ai.ts)): Deterministic OpenAI and Gemini response payloads with token usage.

### Test Troubleshooting & Tips

- **Playwright Missing Browsers**: If E2E tests fail with missing browser executable, run:
  ```bash
  npx playwright install --with-deps chromium
  ```
- **Port 3000 in Use**: Playwright automatically starts `next dev` on port 3000. If port 3000 is occupied by a prior process, kill it before running `npm run test:e2e`:
  ```powershell
  # Windows PowerShell:
  Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process
  ```
- **Single Test File**: Run a single unit test during rapid iterations:
  ```bash
  npx vitest run tests/unit/api-client.test.ts
  ```

---

## 6. How to Start a Real Hackathon Project

Never develop project-specific hackathon features directly on the master template.

1. **Create an Independent Repository**:
   - On GitHub, click **Use this template** -> **Create a new repository**, or:
   - Locally clone or copy this repository into a new folder and re-initialize Git:
     ```bash
     cp -r Hackathon-starter my-hackathon-project
     cd my-hackathon-project
     rm -rf .git && git init
     ```
2. **Follow the Transformation Workflow**:
   - Consult [TEMPLATE_GUIDE.md](file:///c:/Users/rspma/Downloads/Hackathon-starter/TEMPLATE_GUIDE.md) and [docs/HACKATHON-KICKOFF.md](file:///c:/Users/rspma/Downloads/Hackathon-starter/docs/HACKATHON-KICKOFF.md).
   - Categorize existing elements into **KEEP**, **MODIFY**, **REPLACE**, or **REMOVE**.
   - **KEEP** reusable infrastructure: `src/lib/supabase/`, `src/lib/env.ts`, `src/lib/utils/`, UI primitives in `src/components/ui/`, test setups.
   - **REPLACE** demonstration screens: replace `src/app/page.tsx` and `src/components/dashboard/` with your actual challenge UI.
   - **REMOVE** unneeded infrastructure: if your solution is a public tool without accounts, remove authentication routes without breaking routing.

---

## 7. Key Documentation Index

- [docs/CAPABILITY-CATALOG.md](file:///c:/Users/rspma/Downloads/Hackathon-starter/docs/CAPABILITY-CATALOG.md) — Inventory of modular capabilities (reliability, security, AI, testing).
- [AGENTS.md](file:///c:/Users/rspma/Downloads/Hackathon-starter/AGENTS.md) — Operating guide and rules for AI coding assistants.
- [TEMPLATE_GUIDE.md](file:///c:/Users/rspma/Downloads/Hackathon-starter/TEMPLATE_GUIDE.md) — Template identity, infrastructure boundaries, and transformation rules.
- [docs/HACKATHON-KICKOFF.md](file:///c:/Users/rspma/Downloads/Hackathon-starter/docs/HACKATHON-KICKOFF.md) — Copy-ready hackathon day launch runbook.
- [docs/SECURITY-AND-QUALITY-AUDIT.md](file:///c:/Users/rspma/Downloads/Hackathon-starter/docs/SECURITY-AND-QUALITY-AUDIT.md) — Security audit findings, headers, and safe redirect controls.
- [docs/API-KEY-SETUP.md](file:///c:/Users/rspma/Downloads/Hackathon-starter/docs/API-KEY-SETUP.md) — Provider setup, dashboard links, safe verification, and credit limits.
- [docs/ARCHITECTURE.md](file:///c:/Users/rspma/Downloads/Hackathon-starter/docs/ARCHITECTURE.md) — System architecture, cookie flow, and request lifecycle.
- [docs/SETUP.md](file:///c:/Users/rspma/Downloads/Hackathon-starter/docs/SETUP.md) — Setup and deployment guide (Vercel & Supabase).
- [docs/AGENT-WORKFLOW.md](file:///c:/Users/rspma/Downloads/Hackathon-starter/docs/AGENT-WORKFLOW.md) — Standard 8-step agent development loop.
