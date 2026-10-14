import { Suspense } from 'react'
import { Metadata } from 'next'
import { LoginForm } from '@/components/auth/login-form'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Sign In | Hackathon Starter',
  description: 'Sign in to access your hackathon application workspace',
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-md mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Home
        </Link>
      </div>

      <Suspense fallback={<div className="h-96 w-full max-w-md animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
