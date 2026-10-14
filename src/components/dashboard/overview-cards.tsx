import { Database, ShieldCheck, Zap, Layers } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface OverviewCardsProps {
  isConfigured: boolean
  userEmail?: string
}

export function OverviewCards({ isConfigured, userEmail }: OverviewCardsProps) {
  const cards = [
    {
      title: 'Database & Auth',
      value: isConfigured ? 'Supabase Connected' : 'Configuration Pending',
      badge: isConfigured ? 'Active' : 'Mock / Local',
      badgeVariant: (isConfigured ? 'success' : 'warning') as 'success' | 'warning',
      description: isConfigured
        ? 'Real PostgreSQL & Auth ready'
        : 'Set credentials in .env.local to activate',
      icon: Database,
    },
    {
      title: 'Auth Session',
      value: userEmail ? 'Authenticated' : 'Preview Session',
      badge: userEmail ? 'Verified' : 'Guest/Dev',
      badgeVariant: (userEmail ? 'success' : 'secondary') as 'success' | 'secondary',
      description: userEmail || 'Simulated development identity',
      icon: ShieldCheck,
    },
    {
      title: 'Architecture',
      value: 'Next.js 16 App Router',
      badge: 'Turbopack',
      badgeVariant: 'default' as const,
      description: 'Strict TypeScript, Server Components',
      icon: Zap,
    },
    {
      title: 'Design System',
      value: 'Tailwind v4 + shadcn',
      badge: 'Ready',
      badgeVariant: 'secondary' as const,
      description: 'Polished tokens, responsive layout',
      icon: Layers,
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <Card key={card.title} className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">
                {card.title}
              </CardTitle>
              <div className="rounded-md bg-slate-100 dark:bg-slate-800 p-2 text-slate-700 dark:text-slate-300">
                <Icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-2">
                <div className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 truncate">
                  {card.value}
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {card.description}
                </p>
                <Badge variant={card.badgeVariant} className="text-[10px] shrink-0 ml-2">
                  {card.badge}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
