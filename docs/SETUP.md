# Setup and Deployment Guide

## 1. Prerequisites

- **Node.js**: version `20.x` or later (tested on Node `24.x`)
- **Package Manager**: `npm` (v10+ or v12+)
- **Git**
- A free **Supabase** account (for live database and auth)
- A **Vercel** account (for cloud deployment)

## 2. Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/sakshamgupta005/Hackathon-starter.git
cd Hackathon-starter
npm install
```

## 3. Environment Configuration

Copy the template environment file:

```bash
cp .env.example .env.local
```

Open `.env.local` and supply your Supabase project credentials:

```ini
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-id>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your-anon-publishable-key>
# NEXT_PUBLIC_SUPABASE_ANON_KEY is also supported as an alias
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-publishable-key>

# Public Site URL (Used for auth redirects)
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

> **Note**: The application runs safely even before adding credentials. If credentials are not yet set, the dashboard displays an informative preview banner and forms prompt you to configure `.env.local`.

## 4. Supabase Project Setup

1. Create a new project in the [Supabase Dashboard](https://supabase.com/dashboard).
2. Navigate to **Project Settings** -> **API** to copy your **Project URL** and **anon public key**.
3. Under **Authentication** -> **URL Configuration**:
   - Set **Site URL** to: `http://localhost:3000` (or your production Vercel domain).
   - Add Redirect URLs:
     - `http://localhost:3000/auth/callback`
     - `https://<your-project>.vercel.app/auth/callback`
4. Under **Authentication** -> **Providers** -> **Email**:
   - Ensure Email provider is enabled.
   - For local hackathon testing, you may optionally toggle "Confirm email" off if you want instant logins without clicking email links.

## 5. Local Development

Start the development server:

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) in your browser.

## 6. Testing

Run automated checks:

```bash
# Run Vitest unit & component test suite
npm test

# Run TypeScript type check
npm run typecheck

# Run ESLint
npm run lint

# Run Playwright E2E smoke tests (Make sure dev server is running or let Playwright launch it)
npm run test:e2e
```

## 7. Production Build

Test your production bundle locally before deploying:

```bash
npm run build
npm start
```

## 8. Vercel Deployment

Deploying this starter to Vercel is seamless:

1. Push your repository to GitHub.
2. In the [Vercel Dashboard](https://vercel.com/new), import your GitHub repository.
3. In the **Environment Variables** section, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITE_URL` (set to your Vercel URL, e.g., `https://your-app.vercel.app`)
4. Click **Deploy**.
5. Copy your assigned Vercel URL and add `https://your-app.vercel.app/auth/callback` to your Supabase **Redirect URLs**.

## 9. Troubleshooting

- **`Unhandled Promise Rejection: fetch failed`**: Check that your `NEXT_PUBLIC_SUPABASE_URL` is spelled correctly and includes `https://`.
- **`AuthApiError: Invalid login credentials`**: Confirm that the user exists in your Supabase Auth Users table or that they have confirmed their email address.
- **`Redirect loop between /login and /dashboard`**: Clear browser cookies for `localhost` to remove stale or corrupted session tokens.
