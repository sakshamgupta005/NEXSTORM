# System Architecture & Technical Specifications

## 1. Architectural Overview

The Hackathon Starter is designed as a modular, decoupled full-stack architecture built on Next.js 16 (App Router), Supabase (Auth + PostgreSQL), and Tailwind CSS v4.

```
                         Browser Client
                               |
                               v
                       Next.js Middleware
                     (src/middleware.ts)
                               |
            +------------------+------------------+
            |                                     |
            v                                     v
   Public Route (/)                     Protected Route (/dashboard)
            |                                     |
            |                                     v
            |                            Server Component
            |                      (supabase.auth.getUser())
            |                                     |
            +------------------+------------------+
                               |
                               v
                   Supabase Auth & Database
                 (@supabase/ssr Cookie Session)
```

## 2. Authentication Lifecycle

1. **Session Propagation**:
   - Authentication tokens are maintained in HTTP cookies managed by `@supabase/ssr`.
   - The Next.js middleware (`src/middleware.ts` calling `src/lib/supabase/middleware.ts`) refreshes the session on every non-static request.
2. **Server-Side Verification**:
   - Protected routes (`/dashboard`) independently invoke `await supabase.auth.getUser()` in their Server Component.
   - If no valid user is returned, the user is redirected via HTTP 307 to `/login?redirectTo=/dashboard`.
3. **PKCE & Email Confirmation**:
   - Email verification links and OAuth callbacks route to `/auth/callback?code=...`.
   - `src/app/auth/callback/route.ts` exchanges the auth code for a valid session using `supabase.auth.exchangeCodeForSession(code)`.

## 3. Directory Structure

```
├── docs/                   # Engineering documentation
│   ├── ARCHITECTURE.md     # System design & request lifecycle
│   ├── SETUP.md            # Environment & deployment guides
│   └── AGENT-WORKFLOW.md   # Standard development loop for AI agents
├── public/                 # Static assets
├── src/
│   ├── app/                # App Router pages and API routes
│   │   ├── auth/           # Callback and action routes
│   │   ├── dashboard/      # Authenticated workspace
│   │   ├── login/          # Sign-in route
│   │   ├── signup/         # Account registration route
│   │   ├── globals.css     # Design tokens and styles
│   │   ├── layout.tsx      # Root application layout
│   │   ├── not-found.tsx   # 404 handler
│   │   └── page.tsx        # Public landing page
│   ├── components/
│   │   ├── auth/           # Login & signup form components
│   │   ├── dashboard/      # Overview cards, project placeholders, setup alerts
│   │   ├── layout/         # Navbar, footer, dashboard shell
│   │   └── ui/             # Reusable design primitives (shadcn/ui style)
│   ├── lib/
│   │   ├── supabase/       # Browser, server, and middleware clients
│   │   ├── utils/          # CSS merge utilities
│   │   └── validations/    # Zod input schemas
│   ├── types/              # TypeScript types
│   └── middleware.ts       # Edge session middleware
├── tests/
│   ├── components/         # React Testing Library component tests
│   ├── e2e/                # Playwright smoke tests
│   └── unit/               # Schema and utility tests
├── .env.example            # Documented environment template
└── package.json            # Scripts and dependencies
```

## 4. UI/UX Foundations & Theming

- **Tailwind CSS v4**: Utilizes theme tokens defined in `src/app/globals.css`.
- **Theme Variables**: Supports both Light and Dark mode using semantic CSS variables (`--background`, `--foreground`, `--primary`, `--muted`, `--border`).
- **Accessible Primitives**: Form inputs, buttons, and alert components provide explicit ARIA roles, focus rings, disabled states, and responsive layouts.

## 5. Hackathon Orchestration & Capability Selection

The orchestration engine (`src/lib/orchestration/`) automates the transition from raw problem statement to verified working implementation:

1. **Problem Analysis (`selector.ts`)**: Decomposes problem input into target users, priority workflows, constraints, and architecture.
2. **Capability Matching (`capability-registry.ts`)**: Evaluates 52 modular capabilities against problem requirements, assigning `KEEP`, `MODIFY`, or `REMOVE` actions.
3. **Topological Plan Generation**: Produces dependency-ordered implementation tasks (P1 Domain -> P2 Service -> P3 UI -> P4 E2E) with verification checks.
4. **Project Initializer (`init.ts` / `scripts/hackathon-init.mjs`)**: Scaffolds `HACKATHON-PLAN.md` with environment credential audits and baseline checks.

## 6. Bounded AI Execution Engine

The bounded execution loop (`src/lib/orchestration/bounded-loop.ts` and `src/lib/agent/orchestrator.ts`) enforces strict limits on autonomous agent actions:

- **Iteration Caps**: Hard maximum of 5–15 iterations to prevent runaway loops.
- **Human Approval Guards**: Interactive confirmation required prior to destructive actions (database drops, shell deletes, deployments).
- **Evidence-Based Completion**: Never claims success without automated test verification evidence.
- **Deterministic Mock Fallback**: Seamless fallback to offline mock adapters when third-party API credentials are unset.

