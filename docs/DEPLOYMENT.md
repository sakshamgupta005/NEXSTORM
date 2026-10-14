# Production Deployment & Release Guide

This guide details the deployment, containerization, and release verification capabilities for the **Hackathon Starter**. It follows the core directive:
> **The starter serves the future product. The future product does not serve the starter.**
> The deployment architecture is modular, vendor-neutral, and supports zero-cost local validation, containerization, and serverless hosting without paid cloud provider lock-in.

---

## 1. Deployment Architecture & Prerequisites

### Runtime Requirements
- **Node.js**: `v20.x` or `v22.x` (LTS recommended)
- **Package Manager**: `npm` (`npm ci` for deterministic lockfile installations)
- **Default Port**: `3000` (configurable via `PORT` environment variable)
- **Container Engine (Optional)**: Docker 24+ and Docker Compose v2+ (for container deployments)

### Zero-Crash Startup Guarantee
If database, authentication, or AI credentials are omitted, the application boots gracefully into local development mode with visual setup instructions (`SetupBanner`). Missing keys never cause build or deployment boot crashes.

---

## 2. Platform Deployment Guides

### Platform A: Vercel (Serverless Next.js App Router)
Vercel is the primary zero-configuration hosting platform for Next.js App Router applications.

#### Deployment Steps:
1. **Install Vercel CLI** (or import repository directly in Vercel Dashboard):
   ```bash
   npm i -g vercel
   ```
2. **Link and Deploy Preview**:
   ```bash
   vercel
   ```
3. **Deploy to Production**:
   ```bash
   vercel --prod
   ```
4. **Environment Variables**:
   In Vercel Dashboard > Project Settings > Environment Variables, configure:
   - `NODE_ENV=production`
   - `NEXT_PUBLIC_APP_VERSION=0.1.0`
   - (Optional) `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - (Optional) `OPENAI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, or `GROQ_API_KEY`
5. **Configuration File**: [`vercel.json`](file:///c:/Users/rspma/Downloads/Hackathon-starter/vercel.json) specifies the `nextjs` framework and clean URLs.

---

### Platform B: Render (Web Services & Blueprints)
Render provides managed container and web service hosting with native support for Infrastructure-as-Code via [`render.yaml`](file:///c:/Users/rspma/Downloads/Hackathon-starter/render.yaml).

#### Deployment Steps:
1. In the Render Dashboard, select **New > Blueprint**.
2. Connect your repository containing [`render.yaml`](file:///c:/Users/rspma/Downloads/Hackathon-starter/render.yaml).
3. Render automatically provisions:
   - **Service Name**: `hackathon-starter`
   - **Runtime**: `node` (Node.js 22)
   - **Build Command**: `npm ci && npm run build`
   - **Start Command**: `npm run start`
   - **Health Check Path**: `/api/health`
4. Add any secret keys in the Render Environment Variables UI.

---

### Platform C: Docker & Docker Compose (Self-Hosted / VPS / Coolify / Railway / Fly.io)

The repository provides a production-grade multi-stage [`Dockerfile`](file:///c:/Users/rspma/Downloads/Hackathon-starter/Dockerfile) with non-root security enforcement:

#### Multi-Stage Architecture:
1. **`base`**: `node:22-alpine` with `libc6-compat`.
2. **`deps`**: Deterministic dependency installation via `npm ci --ignore-scripts`.
3. **`builder`**: Compiles production Next.js application with `NEXT_TELEMETRY_DISABLED=1`.
4. **`runner`**: Minimal production runtime using unprivileged user `nextjs` (UID 1001) and native container health checks.

#### Docker Build & Execution Commands:
```bash
# 1. Build the production container image
docker build -t hackathon-starter:latest .

# 2. Run container locally with environment file
docker run -d \
  -p 3000:3000 \
  --name hackathon-app \
  --env-file .env \
  hackathon-starter:latest

# 3. Verify container health status
docker inspect --format='{{json .State.Health.Status}}' hackathon-app
```

#### Docker Compose (Local Emulation & Staging):
```bash
# Start container in detached mode
docker compose up -d

# View real-time container logs
docker compose logs -f web

# Stop container
docker compose down
```

---

## 3. Pre-Release Readiness Audit

Before deploying or submitting a project, run the automated release audit:

```bash
npm run release:check
```

### What `release:check` Evaluates:
1. **`NODE_ENV` Mode**: Flags warnings if set to `development` when auditing for production.
2. **Placeholder Credential Scanning**: Scans sensitive keys (`OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`) for dummy values (`your-...`, `placeholder-...`, `TODO-...`, `change-me`).
3. **Client Secret Separation**: Fails if server secrets are mistakenly prefixed with `NEXT_PUBLIC_`.
4. **Credential Pair Cohesion**: Ensures Supabase project URL and anon keys are either both present or cleanly omitted.
5. **Zero Secret Printing**: All scanned secret values are strictly masked (e.g. `sk-...def`) and never printed in logs or audit outputs.

---

## 4. Operational Health & Probes

The application provides an enterprise-ready health check endpoint at `/api/health`:

### Probes:
- **Default Health & Release Info**: `GET /api/health`
  Returns status 200, uptime, version, short commit SHA, and dependency configuration status.
- **Fast Liveness Probe**: `GET /api/health?probe=liveness`
  Rapid check used by container orchestrators (Kubernetes, Docker, Render) to confirm process is answering HTTP requests.
- **Readiness Probe**: `GET /api/health?probe=readiness`
  Checks runtime memory consumption (`memoryUsageMb`), server clock sync, and operational state.

### Sample Response (`GET /api/health`):
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "probe": "default",
    "version": "0.1.0",
    "commit": "a1b2c3d",
    "uptimeSeconds": 1420,
    "timestamp": "2026-10-12T18:00:00.000Z",
    "environment": {
      "nodeEnv": "production",
      "supabaseConfigured": true,
      "aiConfigured": true
    },
    "checks": {
      "serverClock": true,
      "runtimeUptime": true,
      "memoryUsageMb": 48
    }
  }
}
```

---

## 5. Post-Deployment Smoke Testing

Once deployed to any environment (local, preview, or production), run the automated smoke test suite:

```bash
# Test local running application
npm run smoke

# Test remote deployment URL
node scripts/smoke-test.mjs https://my-hackathon-app.vercel.app
```

### Checks Executed:
1. **API Health Probe** (`/api/health`): Verifies HTTP 200 and `status: "healthy"`.
2. **Landing Page** (`/`): Verifies HTTP 200 and valid rendered HTML document.
3. **HTTP Security Headers** (`/`): Verifies presence of `X-Frame-Options` and `X-Content-Type-Options`.
4. **404 Route Isolation** (`/_nonexistent_path_404`): Verifies HTTP 404 response and asserts zero internal Node.js stack trace leaks.
5. **Web App Manifest** (`/manifest.webmanifest`): Verifies valid JSON manifest metadata.

---

## 6. Continuous Integration & Release Workflows

The repository includes GitHub Actions workflows under [`.github/workflows/`](file:///c:/Users/rspma/Downloads/Hackathon-starter/.github/workflows/):

- **[`ci.yml`](file:///c:/Users/rspma/Downloads/Hackathon-starter/.github/workflows/ci.yml)**: Runs on every push and pull request to `main`:
  - `npm ci`
  - `npm run lint`
  - `npm run typecheck`
  - `npm test`
  - `npm run build`
  - `npx playwright install` and `npm run test:e2e`
  - `npm run env:check`
- **[`release.yml`](file:///c:/Users/rspma/Downloads/Hackathon-starter/.github/workflows/release.yml)**: Triggered manually (`workflow_dispatch`) or on semantic tags (`v*.*.*`):
  - Runs full verification gate (`npm run verify`).
  - Runs release readiness audit (`npm run release:check`).
  - Validates container configuration via Vitest suite.

---

## 7. Security & Secret Management Checklist

- [ ] **No committed `.env` files**: `.gitignore` strictly excludes `.env*.local` and production env files. Only `.env.example` is committed.
- [ ] **Secret Managers Only**: Store API keys in Vercel, Render, or cloud provider secret managers.
- [ ] **Non-root Container User**: Dockerfile runs under user `nextjs` (UID 1001), never root.
- [ ] **No Static Secrets in Images**: Never use `ENV OPENAI_API_KEY=...` in Dockerfiles; pass secrets at runtime via `--env-file` or orchestration secrets.
- [ ] **Verified Health Probing**: Configure orchestrator health check path to `/api/health`.
