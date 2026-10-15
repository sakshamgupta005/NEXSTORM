'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { loginSchema } from '@/lib/validations/auth'
import { createClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'

import { getSafeRedirectPath } from '@/lib/utils/redirect'

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawRedirectTo = searchParams.get('redirectTo')
  const redirectTo = getSafeRedirectPath(rawRedirectTo, '/dashboard')

  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [fieldErrors, setFieldErrors] = React.useState<{ email?: string; password?: string }>({})
  const [authError, setAuthError] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFieldErrors({})
    setAuthError(null)

    // Validate inputs
    const result = loginSchema.safeParse({ email, password })
    if (!result.success) {
      const formattedErrors: { email?: string; password?: string } = {}
      result.error.issues.forEach((issue) => {
        if (issue.path[0] === 'email') formattedErrors.email = issue.message
        if (issue.path[0] === 'password') formattedErrors.password = issue.message
      })
      setFieldErrors(formattedErrors)
      return
    }

    if (!isSupabaseConfigured()) {
      setAuthError(
        'Supabase is not yet configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file.'
      )
      return
    }

    setIsLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setAuthError(error.message)
        setIsLoading(false)
        return
      }

      router.push(redirectTo)
      router.refresh()
    } catch {
      setAuthError('An unexpected error occurred during sign in. Please try again.')
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md shadow-xl border-slate-200 dark:border-slate-800">
      <CardHeader className="space-y-1 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-md">
          <svg
            width="28"
            height="28"
            viewBox="0 0 40 40"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect x="2" y="2" width="36" height="36" rx="10" fill="#0f172a" />
            <path
              d="M20 7L29 12.5V23.5L20 29L11 23.5V12.5L20 7Z"
              stroke="#94a3b8"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            <path d="M22 11L14 21H21L18 29L26 19H20L22 11Z" fill="#ffffff" />
            <circle cx="20" cy="20" r="2.8" fill="#2563eb" />
          </svg>
        </div>
        <CardTitle className="text-2xl font-bold font-display text-slate-900 dark:text-white">
          Welcome back
        </CardTitle>
        <CardDescription>
          Sign in to access your NEXSTORM research workspace &amp; data console
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit} noValidate>
        <CardContent className="space-y-4">
          {authError && (
            <Alert variant="destructive" className="flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed">{authError}</div>
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={fieldErrors.email}
              autoComplete="email"
              required
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={fieldErrors.password}
              autoComplete="current-password"
              required
            />
          </div>
        </CardContent>

        <CardFooter className="flex flex-col space-y-4">
          <Button type="submit" className="w-full" isLoading={isLoading}>
            Sign In
          </Button>

          <p className="text-center text-xs text-slate-500 dark:text-slate-400">
            Don&apos;t have an account?{' '}
            <Link
              href="/signup"
              className="font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              Sign up
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
