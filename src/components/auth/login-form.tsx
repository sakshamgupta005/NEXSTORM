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
import { AlertCircle, Rocket } from 'lucide-react'

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
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md">
          <Rocket className="h-6 w-6" />
        </div>
        <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
        <CardDescription>
          Sign in to access your hackathon application workspace
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
