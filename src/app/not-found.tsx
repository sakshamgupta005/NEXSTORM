import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Rocket, ArrowLeft } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
        <Rocket className="h-7 w-7" />
      </div>
      <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
        404 - Page Not Found
      </h1>
      <p className="mt-3 max-w-md text-sm text-slate-600 dark:text-slate-400">
        The page you are looking for doesn&apos;t exist or has been moved to another location.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <Link href="/">
          <Button variant="default" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Button>
        </Link>
        <Link href="/dashboard">
          <Button variant="outline" size="sm">
            Go to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  )
}
