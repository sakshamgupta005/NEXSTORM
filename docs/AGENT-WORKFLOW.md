# AI Agent Development Workflow

This document outlines the standard 8-step protocol that coding agents must follow when implementing new features or fixing bugs in this repository.

## The Standard Loop

```
INSPECT ──> PLAN ──> IMPLEMENT ──> TEST ──> OBSERVE ──> FIX ──> VERIFY ──> REPORT
```

### 1. INSPECT
- Read the active problem statement or issue description.
- Inspect the file tree, relevant callers, test suites, and git status before writing code.
- Confirm available packages and versions (`package.json`) to avoid re-inventing existing helpers.

### 2. PLAN
- Define the minimal scope required to satisfy acceptance criteria.
- Identify every touch point: components, route handlers, types, tests, docs.
- Avoid introducing unrequested abstraction layers, redundant dependencies, or speculative features.

### 3. IMPLEMENT
- Adhere to Server Components by default; use `'use client'` only when interactive state or browser APIs require it.
- Keep validation schemas in `src/lib/validations/` and types in `src/types/`.
- Ensure robust error handling that prevents crashes or leaked credentials.

### 4. TEST
- Write or update automated unit/component tests in `tests/` before declaring work done.
- Run `npm test` and `npm run typecheck` locally.

### 5. OBSERVE
- If runtime behavior or styling is modified, inspect output in the terminal, check browser console errors, or run Playwright tests (`npm run test:e2e`).
- Never assume an edit succeeded without observing actual execution output.

### 6. FIX
- If a check fails, isolate the root cause before editing.
- Make the smallest possible fix. Avoid blindly retrying the same command without addressing the underlying condition.

### 7. VERIFY
- Rerun failed checks to prove that the fix worked.
- Rerun regressions (`npm run lint`, `npm run typecheck`, `npm run build`).

### 8. REPORT
- Provide a concise summary of what was changed.
- Report check results with exact statuses (PASS/FAIL/BLOCKED).
- Note any skipped tests, assumptions made, or external credentials required.
