# Hackathon-Day Operating Guide

> **Governing Directive**: The starter serves the future product; the future product does not serve the starter. When the problem statement is revealed, select only what is needed, build the minimum viable core, and verify every step with evidence.

---

## 1. Quick-Start Checklist (T-Minus 0 Minutes)

Run baseline checks before touching any code:

```bash
# 1. Verify Node and dependencies
npm install

# 2. Verify baseline environment and quality gates
npm run verify
```

If all 5 gates pass, your starting point is 100% healthy.

---

## 2. Kickoff: Submit Problem Statement to Antigravity

Run the initialization script:

```bash
# Option A: Command line
npm run hackathon:init -- "Your Project Title" --desc "Full problem statement description..."

# Option B: From problem file
npm run hackathon:init -- --file problem-statement.md
```

This generates `HACKATHON-PLAN.md` with matched capabilities, excluded starter bloat, required credentials, and topologically ordered tasks.

### Copy-Ready Antigravity Kickoff Prompt

Copy and paste this into Antigravity when the hackathon problem statement is announced:

```markdown
I am building a hackathon solution for the following problem statement:

<PROBLEM_STATEMENT>
[PASTE PROBLEM STATEMENT HERE]
</PROBLEM_STATEMENT>

Constraints & Rules:
1. Follow the Hackathon Starter Operating Guide (docs/HACKATHON-DAY-GUIDE.md).
2. Run `npm run hackathon:init` to analyze capabilities and create HACKATHON-PLAN.md.
3. Keep the architecture lean: KEEP relevant starter modules, REMOVE unneeded modules.
4. Implement in prioritized milestones (P1 -> P2 -> P3 -> P4).
5. Never claim success without verification evidence (run `npm test` and `npm run typecheck` after each milestone).
6. Never crash on missing API keys; fall back to built-in offline mock adapters.
7. Present the proposed architecture and selected capabilities before modifying core files.
```

---

## 3. Reviewing Architecture & Capability Selection

When Antigravity generates the proposal:
1. **Check Keep vs Remove**: Ensure unrelated starter capabilities (e.g., Stripe payments if the app does not sell anything, or Leaflet maps if there is no geolocation) are categorized as `REMOVE`.
2. **Review Data Entities**: Ensure the data model in `src/types/` represents only what the problem requires.
3. **Verify Fallback Strategy**: Verify that offline mock adapters are enabled for any services where API keys are unavailable.

---

## 4. Milestone Pacing & Implementation Prompts

Work in 4 distinct milestones to maximize demo readiness:

### Milestone 1: Domain Foundation (P1)
**Prompt**:
```markdown
Execute Milestone 1 from HACKATHON-PLAN.md:
1. Define TypeScript domain types and Zod schemas in `src/types/`.
2. Run `npm run typecheck` to verify strict compilation.
3. Report any ambiguities in data models.
```

### Milestone 2: Core Service Layer with Mocks (P2)
**Prompt**:
```markdown
Execute Milestone 2 from HACKATHON-PLAN.md:
1. Implement the core service layer connecting business logic and AI/persistence.
2. Wire provider adapters with deterministic offline mock fallbacks.
3. Write unit tests in `tests/unit/` proving core logic succeeds with and without live credentials.
4. Run `npm test` and verify all tests pass.
```

### Milestone 3: UI & Workflow Assembly (P2)
**Prompt**:
```markdown
Execute Milestone 3 from HACKATHON-PLAN.md:
1. Assemble user-facing routes using starter AppShell and UI components.
2. Ensure loading states, error states, and empty states are handled cleanly with `StateViews`.
3. Verify production compilation with `npm run build`.
```

### Milestone 4: End-to-End Demo Verification (P3-P4)
**Prompt**:
```markdown
Execute Milestone 4 from HACKATHON-PLAN.md:
1. Write an automated integration test exercising the primary user demo flow.
2. Run `npm run release:check` to verify Docker & release readiness.
3. Run `npm run verify` to prove all quality gates pass.
4. Provide a concise summary of verified features and demo instructions.
```

---

## 5. Handling Hackathon Failure Modes

| Scenario | Symptom | Action |
| :--- | :--- | :--- |
| **Missing API Keys** | Upstream provider returns 401 or throws | Set `fallback: 'mock'` in AI/search/voice client options. The built-in mock returns realistic fixtures without external requests. |
| **API Rate Limits (429)** | External API throttles mid-demo | `safeFetch` and `createAIClient` automatically back off with jitter. If exhausted, fallback mock takes over seamlessly. |
| **Build Error in Production** | `npm run build` fails on dynamic route | Ensure async APIs (`cookies()`, `headers()`) are awaited (`await cookies()`). Run `npm run typecheck` first. |
| **Port Conflict** | Port 3000 already in use | Run `npm run dev -- -p 3001` or let Next.js choose the next open port automatically. |
| **Unsaved Form Data Loss** | Page reload clears entered data | Use starter `useLocalStorage` or `useMultiStepForm` draft persistence. |

---

## 6. Reliable Demo Preparation (Final 60 Minutes)

1. **Verify Health Endpoint**: Ensure `GET /api/health` returns `200 OK`.
2. **Seed Deterministic Fixtures**: Use starter `tests/fixtures/` to pre-populate sample records so the demo never starts with a blank screen.
3. **Record Demo Video / Fallback Screenshots**: In case of network drops at the podium, have screenshots of key screens ready in your repository.
4. **Final Gate Run**:
   ```bash
   npm run verify
   ```
5. **Freeze Code**: 30 minutes before demo, freeze feature work; focus entirely on rehearsal.
