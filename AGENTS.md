<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Hackathon Starter — AI Agent Operating Guide

Welcome to the Hackathon Starter repository. This guide sets explicit expectations and guardrails for AI coding assistants working in this codebase.

## 0. Governing Directive: Infrastructure-First Hackathon Template

> **THE STARTER SERVES THE FUTURE PRODUCT. THE FUTURE PRODUCT DOES NOT SERVE THE STARTER.**
> When there is a conflict between preserving the starter's appearance and meeting the real project's requirements, the real project's requirements win.

### The Skeleton-First Principle
- Treat this repository like the bones, joints, and internal systems of a body whose identity is not yet known.
- Build and maintain: reliable routing, authentication & persistence, server integrations, strict type safety, input validation, error handling, env management, automated tests, and deployment readiness.
- **Do not invent the product before it exists**: Never build the finished body, its face, its skin, or its personality.

### Frontend Policy (Neutral, Minimal, Replaceable)
- The current frontend exists **only to verify that application infrastructure works**.
- Keep it deliberately neutral, minimal, and easy to replace.
- Use only enough UI to:
  - Verify that the app boots and routes resolve.
  - Test registration, login, logout, and protected routes.
  - Verify backend services and environment variables connect correctly.
  - Display loading, empty, error, and success states.
  - Provide a simple temporary navigation structure for testing.
- **Do not invest in**:
  - Elaborate dashboards or invented product workflows.
  - Fake business data or unnecessary sample features.
  - Strong branding, product-specific illustrations, or decorative animations.
  - Complex design systems or UI components built only to make the starter look impressive.

### The Real Product Always Takes Priority
- When a hackathon problem statement, visual theme, reference site, screenshot, or Figma design is provided, that becomes the sole source of truth.
- Map each starter element to **KEEP**, **MODIFY**, **REPLACE**, or **REMOVE**.
- Replace temporary screens and placeholder flows with the actual product experience.
- Do not preserve a starter component merely because it already exists. Do not remove working infrastructure merely because its temporary example UI is being replaced.

### Avoid Premature Assumptions
Until the real problem statement is provided:
- Do not invent business requirements.
- Do not assume the final product is a SaaS app or needs a dashboard.
- Do not force every project to use authentication, a database, or AI if they are unnecessary for the actual problem.
- Do not build integrations simply because API keys are available in `.env.example`.

---

## 1. Project Overview & Architecture

This repository is a production-grade, domain-agnostic starter designed for rapid prototyping in hackathons.

### Key File Locations

- `src/app/` — Next.js 16 App Router pages, layouts, and route handlers
  - `src/app/page.tsx` — Public landing page
  - `src/app/login/page.tsx` & `src/app/signup/page.tsx` — Authentication forms
  - `src/app/dashboard/page.tsx` — Server-verified protected workspace
  - `src/app/auth/callback/route.ts` — Supabase PKCE and email confirmation exchange
  - `src/app/auth/actions.ts` — Server Actions for auth workflows
  - `src/app/auth/signout/route.ts` — POST route handler for session invalidation
- `src/components/ui/` — Design primitives (shadcn/ui style, accessible, styled with Tailwind CSS v4)
- `src/components/layout/` — Shared shell: `navbar.tsx`, `footer.tsx`, `dashboard-shell.tsx`
- `src/components/auth/` — Client auth components (`login-form.tsx`, `signup-form.tsx`)
- `src/components/dashboard/` — Modular workspace panels (`overview-cards.tsx`, `project-placeholder.tsx`)
- `src/lib/supabase/` — Supabase integration:
  - `client.ts` — Browser client (`createBrowserClient` from `@supabase/ssr`)
  - `server.ts` — Server client (`createServerClient` from `@supabase/ssr` using `await cookies()`)
  - `middleware.ts` — Session refresh and route redirect logic
  - `config.ts` — Credential validation and configuration helpers
- `src/lib/utils/` — Utility functions (`cn` for Tailwind class merges)
- `src/lib/validations/` — Zod schemas (`auth.ts`)
- `src/types/` — Shared TypeScript type declarations
- `tests/` — Automated test suites:
  - `tests/unit/` — Unit tests for validation schemas and configuration logic
  - `tests/components/` — Vitest + React Testing Library component tests
  - `tests/e2e/` — Playwright browser smoke tests
- `docs/` — Engineering specifications and workflows

## 2. Standard Developer Commands

Always use `npm` for this repository:

- `npm run dev` — Start the Next.js local development server with Turbopack
- `npm run build` — Build production bundle (verifies route compilation and SSR)
- `npm run lint` — Run ESLint rules
- `npm run typecheck` — Run TypeScript compiler check without emitting files (`tsc --noEmit`)
- `npm test` — Run Vitest unit & component test suite
- `npm run test:watch` — Interactive Vitest runner
- `npm run test:e2e` — Run Playwright browser test suite

## 3. Server Components vs. Client Components

- **Server Components by default**: Pages, layouts, and data-fetching views must be Server Components (`async function ComponentName()`).
- **Client Components only when required**: Add `'use client'` only when a component uses React hooks (`useState`, `useEffect`), browser event handlers (`onClick`, `onSubmit`), or browser APIs.
- **Data Protection**: Never expose secret keys or server operations to Client Components.
- In Next.js 15/16, note that dynamic APIs like `cookies()` and `headers()` are asynchronous (`const cookieStore = await cookies()`).

## 4. Supabase Security & Environment Standards

- **Key Separation**: Only public/anon keys may use the `NEXT_PUBLIC_` prefix (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
- **Service Role Key**: If a service-role key is introduced in future stages, NEVER prefix it with `NEXT_PUBLIC_`. Keep it server-only.
- **Session Verification**: Use `supabase.auth.getUser()` on the server to securely validate session tokens. Do not trust unverified cookies or `getSession()` on the server.
- **Safe Fallbacks**: If environment variables are missing, the app must not crash. It should render clear setup instructions (`SetupBanner`).

## 5. Quality & Verification Rules

1. **Verify Before Reporting**: Never claim a fix or feature is working without running verification (`npm run typecheck`, `npm test`, or `npm run build`).
2. **Smallest Complete Change**: Implement the minimal, robust change required. Avoid bloat, unnecessary abstraction layers, and unrequested dependencies.
3. **Preserve Integrity**: Do not overwrite unrelated user code or clear commit history.
4. **Git Safety**: Never force push, commit `.env` secrets, or make unverified mass modifications.

## 6. Permanent Constraint — Reusable Template Identity

This repository is a **reusable hackathon starter template**, NOT a standalone single-purpose product.

- **Generic Infrastructure Only**: Build generic, domain-agnostic foundations. Never couple this repository to a specific hackathon problem statement.
- **Protect the Master Template**: When developing an actual hackathon solution, work only inside a copied/derived repository. Never push hackathon-specific features or change the remote of the master template.
- **Optional Infrastructure**: Authentication, dashboards, and databases are modular building blocks, not mandatory for every final solution. Remove or simplify them when a copied project doesn't need them.

## 7. Future Hackathon Transformation Protocol

When given a problem statement in a repository copied from this template, follow this 13-step transformation workflow:

1. **Extract Requirements**: Read the problem statement to define the actual user problem and acceptance criteria.
2. **Inspect Copied Starter**: Review existing routes, components, and clients in the copied repo.
3. **Separate Layers**: Distinguish generic infrastructure (UI primitives, clients, configs) from starter demo content (`OverviewCards`, `ProjectPlaceholder`, template landing page).
4. **Map to Actions**: Categorize each part into `KEEP`, `MODIFY`, `ADD`, or `REMOVE`.
5. **Identify Gaps**: Determine needed data models, third-party integrations, and pages.
6. **Propose Lean Architecture**: Propose the smallest viable architecture that fully satisfies the problem statement.
7. **Implement Directly**: Build the real solution in the copied codebase.
8. **Reuse Infrastructure**: Maximize reuse of existing UI components and Supabase helpers.
9. **Eliminate Placeholders**: Delete or replace starter demo content so the application feels custom-tailored to the challenge.
10. **Preserve Safety**: Retain authentication, error handling, and validation unless unnecessary.
11. **Add Solution Tests**: Write automated tests specifically testing the hackathon product features.
12. **Verify User Journeys**: Run `npm test`, `npm run typecheck`, and `npm run test:e2e` to prove the end-to-end journey works.
13. **Update Documentation**: Rewrite `README.md` and `docs/` to describe the actual hackathon project instead of the template.

