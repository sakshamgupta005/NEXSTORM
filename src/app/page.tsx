import Link from 'next/link'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'

export default async function HomePage() {
  let user = null
  const isConfigured = isSupabaseConfigured()

  if (isConfigured) {
    try {
      const supabase = await createClient()
      const { data } = await supabase.auth.getUser()
      user = data.user
    } catch {
      // In dev fallback
    }
  }

  const infrastructureItems = [
    {
      title: 'Next.js 16 App Router',
      status: 'Active',
      description: 'Server Components by default, async cookie handling, and Turbopack compiler.',
    },
    {
      title: 'Supabase Authentication',
      status: isConfigured ? 'Connected' : 'Setup Pending',
      description: isConfigured
        ? 'Real PostgreSQL database and session verification active.'
        : 'Running in safe local preview mode. Add credentials in .env.local to activate.',
    },
    {
      title: 'Design Primitives',
      status: 'Ready',
      description: 'Neutral Tailwind CSS v4 design tokens and accessible UI components.',
    },
    {
      title: 'Quality & Test Suite',
      status: 'Verified',
      description: 'Vitest unit tests, Playwright browser tests, and GitHub Actions CI configured.',
    },
  ]

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Navbar user={user} />

      <main className="flex-1 container mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
        {/* Neutral Verification Header */}
        <div className="border-b border-slate-200 dark:border-slate-800 pb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Starter Infrastructure
            </span>
            <Badge variant="outline" className="text-[10px]">
              Template Baseline
            </Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Hackathon Starter Foundation
          </h1>
          <p className="mt-2 text-base text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
            This demonstration screen verifies that routing, authentication, and core application
            infrastructure are functional. In a real hackathon project, replace this page with your
            actual product experience.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link href="/city/amritsar">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold">
                Launch Amritsar Risk Map
              </Button>
            </Link>
            {user ? (
              <Link href="/dashboard">
                <Button variant="outline">Open Dashboard</Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="outline">Sign In</Button>
                </Link>
                <Link href="/dashboard">
                  <Button variant="ghost">Test Dashboard Route</Button>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Infrastructure Status Grid */}
        <section className="mt-10">
          <h2 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-200">
            System Verification Status
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {infrastructureItems.map((item) => (
              <Card key={item.title}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold">{item.title}</CardTitle>
                    <Badge variant={item.status === 'Setup Pending' ? 'warning' : 'secondary'}>
                      {item.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-xs">{item.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Extension Instructions */}
        <section className="mt-10 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
          <h3 className="text-sm font-semibold mb-2">How to transform this page</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            When you receive your hackathon brief, delete the demonstration content in{' '}
            <code className="rounded bg-slate-100 dark:bg-slate-800 px-1 py-0.5 font-mono text-[11px]">
              src/app/page.tsx
            </code>{' '}
            and build the actual user interface required by your challenge. All shared primitives in{' '}
            <code className="rounded bg-slate-100 dark:bg-slate-800 px-1 py-0.5 font-mono text-[11px]">
              src/components/ui/
            </code>{' '}
            remain available for reuse.
          </p>
        </section>
      </main>

      <Footer />
    </div>
  )
}
