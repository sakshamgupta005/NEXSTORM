'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signupSchema } from '@/lib/validations/auth'
import { createClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert } from '@/components/ui/alert'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

export function SignupForm() {
  const router = useRouter()

  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')
  const [fieldErrors, setFieldErrors] = React.useState<{
    email?: string
    password?: string
    confirmPassword?: string
  }>({})
  const [authError, setAuthError] = React.useState<string | null>(null)
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFieldErrors({})
    setAuthError(null)
    setSuccessMessage(null)

    const result = signupSchema.safeParse({ email, password, confirmPassword })
    if (!result.success) {
      const formattedErrors: {
        email?: string
        password?: string
        confirmPassword?: string
      } = {}
      result.error.issues.forEach((issue) => {
        if (issue.path[0] === 'email') formattedErrors.email = issue.message
        if (issue.path[0] === 'password') formattedErrors.password = issue.message
        if (issue.path[0] === 'confirmPassword') formattedErrors.confirmPassword = issue.message
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
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        setAuthError(error.message)
        setIsLoading(false)
        return
      }

      if (data.user && !data.session) {
        setSuccessMessage(
          'Registration successful! Please check your email inbox to confirm your email before signing in.'
        )
        setIsLoading(false)
        return
      }

      router.push('/dashboard')
      router.refresh()
    } catch {
      setAuthError('An unexpected error occurred during registration. Please try again.')
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
          Create an account
        </CardTitle>
        <CardDescription>
          Get started with your NEXSTORM research workspace &amp; data console
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

          {successMessage && (
            <Alert variant="success" className="flex items-start gap-2.5">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed">{successMessage}</div>
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="signup-email">Email address</Label>
            <Input
              id="signup-email"
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
            <Label htmlFor="signup-password">Password</Label>
            <Input
              id="signup-password"
              type="password"
              placeholder="Minimum 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={fieldErrors.password}
              autoComplete="new-password"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Repeat password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={fieldErrors.confirmPassword}
              autoComplete="new-password"
              required
            />
          </div>
        </CardContent>

        <CardFooter className="flex flex-col space-y-4">
          <Button type="submit" className="w-full" isLoading={isLoading}>
            Create Account
          </Button>

          <p className="text-center text-xs text-slate-500 dark:text-slate-400">
            Already have an account?{' '}
            <Link
              href="/login"
              className="font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              Sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
