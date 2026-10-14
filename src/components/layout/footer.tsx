import Link from 'next/link'

export function Footer() {
  return (
    <footer className="w-full border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-8">
      <div className="container mx-auto max-w-5xl px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>Hackathon Starter Template — Neutral Foundation</p>

          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-slate-800 dark:hover:text-slate-200">
              Home
            </Link>
            <Link href="/dashboard" className="hover:text-slate-800 dark:hover:text-slate-200">
              Dashboard
            </Link>
            <Link href="/login" className="hover:text-slate-800 dark:hover:text-slate-200">
              Sign In
            </Link>
            <Link href="/signup" className="hover:text-slate-800 dark:hover:text-slate-200">
              Sign Up
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
