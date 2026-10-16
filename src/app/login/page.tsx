import { Suspense } from 'react'
import { Metadata } from 'next'
import { AuthModal } from '@/components/auth/AuthModal'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Sign In | NEXSTORM Urban Intelligence',
  description: 'Sign in to access your NEXSTORM application workspace and settings',
}

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-[#f6f8fc] p-6 font-sans light-premium overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(37,99,235,0.08),transparent_70%)]" />

      <div className="relative w-full max-w-[520px] mb-5 flex items-center">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#334155] hover:text-[#0f172a] transition-all bg-white border border-[#e2e8f0] rounded-full px-4 py-2 shadow-xs hover:shadow active:scale-[0.97]"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </Link>
      </div>

      <div className="relative w-full max-w-[520px]">
        <Suspense fallback={<div className="h-[500px] w-full animate-pulse rounded-3xl bg-white/70 border border-slate-200" />}>
          <AuthModal isModal={false} initialTab="signin" />
        </Suspense>
      </div>
    </div>
  )
}
