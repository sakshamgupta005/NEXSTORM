# Hackathon-Day Kickoff Runbook

This runbook is the immediate operational guide to execute when a new hackathon problem statement is announced. Follow this copy-ready process to transform a copied starter into a winning hackathon submission.

---

## The Governing Law

> **THE STARTER SERVES THE FUTURE PRODUCT. THE FUTURE PRODUCT DOES NOT SERVE THE STARTER.**
> Replace demonstration UI and placeholder workflows immediately with your problem's core functionality.

---

## 1. Copy-Ready Prompt for Your Coding Agent

When you clone this template into a new repository for your hackathon, send this exact kickoff prompt to your coding agent:

```markdown
I am starting a new hackathon project in this repository.
Here is our challenge problem statement and constraints:

[PASTE PROBLEM STATEMENT, TARGET USERS, CONSTRAINTS & JUDGING CRITERIA HERE]

[OPTIONAL: PASTE VISUAL THEME, FIGMA LINK, OR SCREENSHOT DESCRIPTION HERE]

Follow the 12-Step Transformation Process in docs/HACKATHON-KICKOFF.md:
1. Restate problem, target users, constraints, and judging criteria.
2. Define the smallest demonstrable MVP vertical slice.
3. Map existing template code to KEEP, MODIFY, REPLACE, REMOVE, and ADD.
4. Select ONE primary AI provider based on needs, latency, and credits.
5. Build the primary working user journey first before secondary polish.
6. Verify continuously with npm test, npm run typecheck, and npm run build.
```

---

## 2. The 12-Step Transformation Process

Coding agents must execute these 12 steps in order:

### Step 1: Restate Problem & Criteria
- Summarize the core user pain point in 2 sentences.
- Explicitly list target users, technical constraints, and judging rubric weightings (e.g., Innovation, Technical Execution, Business Impact, Polish).

### Step 2: Define Smallest Demonstrable MVP
- Scope the **single vertical slice** that proves the concept during a 3-minute judge demo.
- Cut every secondary screen, settings menu, and non-essential edge case.

### Step 3: Fast-Track Assumptions & Open Questions
- Write down key technical assumptions (e.g., API limits, input formats).
- **Do not freeze in analysis paralysis**: Make a pragmatic decision and move immediately to implementation.

### Step 4: Map Existing Code (KEEP / MODIFY / REPLACE / REMOVE / ADD)
- **KEEP**: Primitives in `src/components/ui/`, Supabase clients in `src/lib/supabase/`, environment validation in `src/lib/env.ts`, test configs.
- **MODIFY**: Navigation in `src/components/layout/navbar.tsx`, database schema for challenge models.
- **REPLACE**: Landing page (`src/app/page.tsx`), dashboard workspace (`src/app/dashboard/`).
- **REMOVE**: Starter-only components (`OverviewCards`, `ProjectPlaceholder`) and any unused capabilities (e.g. remove auth if project is a public utility).
- **ADD**: Domain-specific API routes, AI orchestrators, database tables, and feature components.

### Step 5: Problem-Driven Architecture
- Choose architecture based strictly on problem needs, never out of habit.
- If no user accounts are required, make the root route interactive without login walls.
- If real-time or streaming is needed, wire server-sent events or WebSocket channels.

### Step 6: Select ONE Primary AI Provider
- Choose one provider based on available credits, context length, model strengths, and latency:
  - **Coding / Complex Agent Logic**: Anthropic Claude 3.5 Sonnet
  - **Multimodal / Massive Documents**: Google Gemini (Flash / Pro)
  - **Structured JSON / General Reasoning**: OpenAI (GPT-4o / o-series)
  - **Ultra-Fast Streaming / Voice Inference**: Groq (Llama 3 models)
  - **Live Web Research**: Tavily Search
  - **Speech Output**: ElevenLabs Voice
- Avoid integrating multiple providers unless a fallback is strictly necessary for demo reliability.

### Step 7: Apply Visual Direction
- If reference websites, color palettes, screenshots, or Figma designs were provided, apply their visual tokens to `src/app/globals.css`.
- Ensure high contrast, readable typography, and accessible button tap targets.

### Step 8: Build the End-to-End User Journey First
- Build the "happy path" first: **Input ➔ Processing ➔ Output**.
- Ensure the user can complete the entire core interaction before spending time on secondary states.

### Step 9: Autonomous Bounded Implementation Loop
- Work in small, verifiable cycles:
  `INSPECT ➔ PLAN ➔ IMPLEMENT ➔ TEST ➔ OBSERVE ➔ FIX ➔ VERIFY ➔ REPORT`
- Run local checks after every chunk of changes.

### Step 10: Continuous Verification
- Run tests throughout development (`npm test`, `npm run typecheck`).
- Fix build-breaking errors immediately before adding more features.

### Step 11: Maintain Defect & Fallback Ledger
- Keep a 3-bullet list of known limitations and fallback paths (e.g., cached sample response if live external API fails during live judging).

### Step 12: Finish with a Reproducible Demo & Truthful Report
- Verify complete build with `npm run build` and `npm run test:e2e`.
- Document exact demo instructions and seed data in `README.md`.

---

## 3. Time-Boxed Hackathon Strategy

```
  [0h - 2h]       [2h - 8h]             [8h - 18h]           [18h - 24h]
┌──────────────┬──────────────────────┬────────────────────┬──────────────┐
│  Phase 1:    │  Phase 2:            │  Phase 3:          │  Phase 4:    │
│  Scope & Map │  Core Vertical Slice │  Differentiate &   │  Audit &     │
│  (1-4)       │  (Happy Path Working)│  Polish UI         │  Demo Prep   │
└──────────────┴──────────────────────┴────────────────────┴──────────────┘
```

1. **Hours 0-2 (Scoping & Setup)**: Read problem statement, map code, configure `.env.local` with your chosen provider key, run `npm run env:check`.
2. **Hours 2-8 (The Vertical Slice)**: Get the core feature working end-to-end with real API calls or local mock data. Prove the value proposition.
3. **Hours 8-18 (Depth & Experience)**: Add streaming feedback, refine UI aesthetics to match theme, handle empty/error states, add secondary features.
4. **Hours 18-24 (Demo Freeze & Verification)**: Code freeze. Run `npm run build`, `npm run test:e2e`, record demo screencast, verify fallback demo inputs.
