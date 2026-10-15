import { Suspense } from 'react'
import { Metadata } from 'next'
import { LoginForm } from '@/components/auth/login-form'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Sign In | NEXSTORM Urban Intelligence',
  description: 'Sign in to access your NEXSTORM application workspace and settings',
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f6f8fc] dark:bg-slate-950 p-4 sm:p-6 lg:p-8 font-sans light-premium">
      <div className="w-full max-w-md mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-slate-200 transition-colors bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 shadow-xs"
        >
          <ArrowLeft className="h-3.5 w-3.5 text-blue-600" />
          Back to NEXSTORM Intelligence
        </Link>
      </div>

      <Suspense fallback={<div className="h-96 w-full max-w-md animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
