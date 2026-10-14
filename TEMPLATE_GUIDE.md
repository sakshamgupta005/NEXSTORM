# Hackathon Starter — Template Guide & Transformation Protocol

This repository is a **reusable technical foundation** for future hackathon projects, not a standalone product, SaaS app, or portfolio project.

> **GOVERNING PRINCIPLE**:
> **THE STARTER SERVES THE FUTURE PRODUCT. THE FUTURE PRODUCT DOES NOT SERVE THE STARTER.**
> When there is a conflict between preserving the starter's appearance and meeting the real project's requirements, the real project's requirements win.

---

## The Skeleton-First Principle

Treat this repository like the bones, joints, and internal systems of a body whose identity is not yet known:
- **Build and maintain**: Reliable application architecture, routing, authentication, database persistence, server integrations, strict type safety, input validation, error handling, environment-variable management, automated testing, and build verification.
- **Do not invent the product before it exists**: Do not build the finished body, its face, its skin, or its personality until a hackathon problem statement is provided.

## Frontend Policy (Neutral, Minimal, Easy to Replace)

The starter frontend exists **only to verify that the application infrastructure works**. It is deliberately kept neutral and minimal:
- Verify that the application boots and routes function properly.
- Test sign-up, login, logout, and protected routes.
- Verify that backend services and environment variables connect correctly.
- Demonstrate loading, empty, validation, and error states.
- Provide a simple temporary navigation structure for testing.

**We deliberately do NOT invest in**:
- Elaborate dashboards or invented product workflows.
- Fake business data or unnecessary sample features.
- Strong branding, product-specific illustrations, or decorative animations.
- Complex design systems or UI components built only to make the starter look impressive.

## 1. What This Repository Provides

- **Framework**: Next.js 16 (App Router) with React 19, strict TypeScript, and Turbopack.
- **Styling & Design System**: Tailwind CSS v4 with semantic tokens (`globals.css`) and accessible UI primitives in `src/components/ui/` (shadcn/ui style).
- **Authentication & Database**: Official Supabase integration via `@supabase/ssr`, Next.js 16 Edge proxy session refresh, cookie handling, PKCE callback, and Zod input validation schemas.
- **Application Shell**: Responsive navigation (`Navbar`, `Footer`, `DashboardShell`), error/loading boundaries, and not-found handling.
- **Testing Infrastructure**: Automated Vitest (unit & component tests) and Playwright (E2E smoke tests).
- **Graceful Fallbacks**: Previews and actionable setup banners when environment variables are unconfigured.

---

## 2. Infrastructure vs. Demonstration Content

| Layer | Type | Description | Action in a Real Hackathon |
| :--- | :--- | :--- | :--- |
| `src/lib/supabase/` | **Reusable Infrastructure** | Server, browser, and proxy clients, session refresh, config helpers. | **KEEP** (or simplify if auth/DB not needed). |
| `src/components/ui/` | **Reusable Infrastructure** | Accessible buttons, inputs, labels, cards, badges, alerts. | **KEEP** & extend with project UI. |
| `src/proxy.ts` | **Reusable Infrastructure** | Next.js 16 session refresh and protected route interception. | **KEEP** or adjust protected path patterns. |
| `src/lib/validations/` | **Reusable Infrastructure** | Zod input schemas for validation. | **KEEP** & add domain schemas. |
| `src/app/page.tsx` | **Demonstration Content** | Generic landing page highlighting template capabilities. | **REPLACE** with your hackathon product landing page. |
| `src/app/dashboard/` | **Demonstration Content** | Workspace preview with starter metrics and feature canvas. | **TRANSFORM** into your product's actual workspace. |
| `src/components/dashboard/` | **Demonstration Content** | `OverviewCards`, `ProjectPlaceholder`, `SetupBanner`. | **REPLACE** with product-specific panels, feeds, or widgets. |

---

## 3. How to Create an Independent Project

Never build hackathon-specific features directly on `main` of the master template. Follow these steps:

### Option A: GitHub "Use this template" Button
1. On GitHub, click **Use this template** -> **Create a new repository**.
2. Name the new repository after your hackathon project (e.g., `health-ai-assistant`).
3. Clone the new repository to your local machine:
   ```bash
   git clone https://github.com/<your-username>/<your-project>.git
   cd <your-project>
   npm install
   ```

### Option B: Local Copy
```bash
# Clone or copy into a fresh directory
cp -r Hackathon-starter my-hackathon-project
cd my-hackathon-project
rm -rf .git
git init
git remote add origin https://github.com/<your-username>/<your-project>.git
npm install
```

---

## 4. How to Give an AI Agent a Problem Statement

When initiating work with an AI agent in the copied repository, prompt the agent with the problem statement using this prompt structure:

```markdown
You are operating in a copied instance of the Hackathon Starter Template.
Our hackathon problem statement is:
"<INSERT PROBLEM STATEMENT HERE>"

Follow the Transformation Protocol in AGENTS.md:
1. Map requirements to KEEP, MODIFY, ADD, or REMOVE.
2. Select the smallest viable architecture.
3. Transform the copied starter into the product the problem statement requires.
4. Replace starter demonstration content (landing page, placeholder dashboard) with the real solution.
5. Verify with automated tests and browser checks.
```

---

## 5. The 13-Step Transformation Protocol

When transforming a copied starter for a specific hackathon, follow this workflow:

1. **Read & Extract**: Extract actual user problems, target audiences, and core value propositions from the brief.
2. **Inspect Existing Code**: Review the copied starter's components, clients, and routes.
3. **Separate Layers**: Distinguish generic infrastructure from demo-only content.
4. **Categorize Components (KEEP / MODIFY / ADD / REMOVE)**:
   - **KEEP**: UI primitives, styling tokens, utilities, testing configs.
   - **MODIFY**: Layouts, navbars, auth flows, database models.
   - **ADD**: Domain-specific pages, server actions, AI pipelines, integrations.
   - **REMOVE**: Starter placeholders (`ProjectPlaceholder`, starter hero text, unused routes).
5. **Identify Gaps**: List required third-party APIs (e.g., OpenAI, Anthropic, Stripe, Maps), database tables, and routes.
6. **Propose Smallest Viable Architecture**: Design the leanest architecture that solves the problem. Do not over-engineer.
7. **Implement Directly**: Build the domain features in the codebase.
8. **Reuse Infrastructure**: Maximize reuse of existing UI components, styling tokens, and Supabase clients.
9. **Remove Starter Artifacts**: Delete or replace starter-only placeholders so the app feels 100% purpose-built.
10. **Preserve Operational Safety**: Keep working authentication, validation, and error boundaries unless explicitly unnecessary.
11. **Add Product Tests**: Add domain-specific unit and E2E smoke tests.
12. **Verify User Journeys**: Run `npm test`, `npm run typecheck`, and `npm run test:e2e` to prove the solution works end-to-end.
13. **Update Product Documentation**: Rewrite `README.md` and `docs/` to document the actual hackathon project instead of the starter template.

---

## 6. Intelligent Product Decisions

Every hackathon project has different architectural requirements:

- **Public Tool / Static Content**: Remove auth routes and session proxy; make the root page interactive.
- **AI / RAG Application**: Keep Supabase for vector embeddings (`pgvector`); add streaming AI endpoints.
- **Collaborative App**: Use Supabase Realtime subscriptions; remove static dashboard panels.
- **Hardware / Vision Demo**: Connect client-side camera/inference streams; strip conventional SaaS navigation.

Never force every problem into a SaaS dashboard mold.

---

## 7. Protecting the Master Template

- **One-Way Flow**: Code flows from the master template to copied hackathon projects, never back (unless refining general-purpose tooling).
- **No Domain Commits**: Never commit challenge-specific logic or third-party API keys to the master template.
- **Review General Improvements**: Only push improvements to the master template if they benefit *all future hackathons* (e.g., framework updates, bug fixes, generic UI components).
