import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { Button } from '@/components/ui/button'

interface NavbarProps {
  user?: User | null
}

export function Navbar({ user }: NavbarProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur">
      <div className="container mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="font-semibold tracking-tight text-slate-900 dark:text-slate-100 text-sm">
          Hackathon Starter
        </Link>

        <nav className="flex items-center space-x-4 text-sm font-medium text-slate-600 dark:text-slate-300">
          <Link href="/" className="transition-colors hover:text-slate-900 dark:hover:text-white">
            Home
          </Link>
          <Link href="/dashboard" className="transition-colors hover:text-slate-900 dark:hover:text-white">
            Dashboard
          </Link>
        </nav>

        <div className="flex items-center space-x-2">
          {user ? (
            <Link href="/dashboard">
              <Button size="sm">Dashboard</Button>
            </Link>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  Sign In
                </Button>
              </Link>
              <Link href="/signup">
                <Button size="sm">Sign Up</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
